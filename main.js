// 3.6 Adding signalling with Agora RTM
// let APP_ID = "3e7555c434a74488883b830a97e7dfb1";
let token = null;

// 3.7 generate some kind of random uid
let uid = String(Math.floor(Math.random() * 10000)) // every single user in the application needs a uid

// 3.8 create a client object
let client;
let channel; // this is the channel that 2 users will join. this will allow messages to be sent to this channel

//11. parse url and get the room value
let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room') // this will get the id in the route link

//11.1 if theres no roomid entered we want to redirect them back to the correct room first
if(!roomId){
    window.location = 'lobby.html'
}


// create variable for local stream and one for remote stream
// local stream - local camera's video and audio feed 
// remote stream - remote user's video and audio data
let localStream;
let remoteStream;
let peerConnection;

// 3. Set up STUN severs. 
const servers = { // pass this object into RTCPeerConnection
    iceServers:[
        {
            urls:['stun:stun1.1.google.com:19302','stun:stun2.1.google.com:19302'] // copy the actl google stun servers into here
        } 
    ]
}
//15. create constraints to improve video quality
let constraints = {
    video: {
        width: {min:640,ideal:1920, max:1920}, //set min width as 640 set idea as 1920
        height: {min:480, ideal:1080, max:1080},
    },
    audio:true
}

// 1. create this first.
let init = async () => {
    
    //3.8 create client object 
    client = await AgoraRTM.createInstance(config.APP_ID)
    await client.login({uid, token})

    // index.html?room=234234
    // 3.9 create channel
    channel = client.createChannel(roomId) //11.3 updated to pass in dynamic roomId instead
    await channel.join() // join the channel

    // 4.0 listen for whenever any other client actually joins the same channel
    channel.on('MemberJoined',handleUserJoined)

    //9.1 listen for member left
    channel.on('MemberLeft',handleUserLeft)
    //4.2 listen for message from peer
    client.on('MessageFromPeer', handleMessageFromPeer) // anytime someone calls the sendMessageToPeer() to us
    
    //1.1 ask for permission to access our camera and video
    localStream = await navigator.mediaDevices.getUserMedia(constraints) // will req permission to our camera feed and audio
    //1.1 above, we want access to camera, but NOT audio
    document.getElementById('user-1').srcObject = localStream // video tag has a property called srcObject
}
// 9.2 handle user left - to remove the block element rendered for 2nd peer
let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = 'none'
    // when a user tries to leave here, we are actl not leaving the channel.
    // by default if agora detects no activity for 20-30s, then that user left will be triggered
    // we want to log the user out asap - check pt 10.

    //14.1 remove the class when user left
    document.getElementById('user-1').classList.remove('smallFrame')
}

// 4.2 create event listener fn to handle message from a peer
let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text)
    console.log('Message:',message)
    //6. check message type
    if(message.type === 'offer'){
        //6.1 if offer, we take in memberid and offer as param, to create a answer
        createAnswer(MemberId, message.offer)
    }

    if(message.type === 'answer'){
        // 6.2 handle when we receive a message type - answer
        // process the answer received
        addAnswer(message.answer)
    }
    //8. both peers will send out candidates so we need to handle this message type
    if(message.type === 'candidate'){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate)
        }
    }

}

// 4.1 create event listener fn to handle user joined
let handleUserJoined = async (MemberId) => {
    console.log('A new user joined the channel:',MemberId)
    createOffer(MemberId)
}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers)
    //2.2 set up a media stream inside the user-2 video element
    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream 
    document.getElementById('user-2').style.display = 'block' 
    
    //14.add class of smallFrame to our vidoe (peer 1)
    document.getElementById('user-1').classList.add('smallFrame')

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false}) // will req permission to our camera feed and audio    
        document.getElementById('user-1').srcObject = localStream
    }

    // 3.2 get local tracks and add them to the peerConnection so that our remote peer can actually get them
    // Get my local tracks and add them to the peer connection.
    // we have our local stream alr. we need to loop thru our local stream's tracks andd add them to our peer connection
    // so that our remote peer can get them
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track,localStream) 
    }) // we are gonna add tracks to the peer connection

    // 3.3 Listen for anytime when our remote peer adds tracks
    // anytime remote peer adds tracks , we want to add it to the peer connection and then listen to it
    peerConnection.ontrack = (event) => {
        // looping thru every single track frm our remote peer
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    // 3.4 every signle time we create a ice candidate we create a async function to handle this.
    // when we create a offer, we need to create ICE candidates as well
    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            //4.4 Send ICE candidates to peer. trickle in each candidate 1 by 1.
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate', 'candidate': event.candidate})}, MemberId) 
            
        }
        // 3.5 we need take the offer along w each of the ice candidate generated
        // and we are going to send this to the peer. 
        // once remote peer receives this, they are going to create a sdp answer and send it back to us
        // once this exhange takes place the 2 peers are conn, and data can flow btwn them
        // this process is done thru signalling usually, where we bring both into the same room for the intiial connection
    }

}

// 2. create offer function
let createOffer = async (MemberId) => {
    //2.1 create initial peerConnection - this is the interface to connect with another peer
    await createPeerConnection(MemberId)
    // 3.1 pass servers in as parameters.
    

    // each peer connection will have a offer and a answer
    //2.3 Create Offer
    let offer = await peerConnection.createOffer() 
    
    //2.3 Set local description (using offer)
    await peerConnection.setLocalDescription(offer)
    // when we set the local description, its going to trigger the generation of ice candidates (3.4)
    // will figure off peerConn.onicecandidate
    
    // 4.3 send offer message to peer.
    client.sendMessageToPeer({text:JSON.stringify({'type':'offer', 'offer': offer})}, MemberId) // send this message to a Peer with this Id

    // console.log('Offer:',offer)
    // take offer along with each ice candidate generated, and sent this data to peer.
    // once remote peer gets this information, its going to create a SDP answer, and send back its infomration
    // once exchange is done, connection is completed
    // this process is done thru a process called signalling whr we get some users into a room tgt,
    // instead of using our own signalling server and using websockets manaully, we are gonna use Agora SDK to do this conveniently

}

// 5. create answer function
// this time we will get a offer from the other client 
let createAnswer = async(MemberId, offer) => {
    // 5.1 create peer connection
    await createPeerConnection(MemberId)
    // every single peer will have a local description and a peer description

    // we are setting remote description here, we just need to pass in offer.

    //5.2 remote desc for receiving peer (aka, the 2nd peer who joins) will be the offer
    await peerConnection.setRemoteDescription(offer)

    //5.3 set local description as the answer
    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer) 
    // for 2nd peer, the remote description is the offer, and the local description is the answer

    // 5.4 send the answer back to peer
    client.sendMessageToPeer({text:JSON.stringify({'type':'answer', 'answer': answer})}, MemberId) // send this message to a Peer with this Id

}

// 7. the peer that first initiated the offer, will get back a answer
let addAnswer = async (answer) => {
    if(!peerConnection.currentRemoteDescription){
        //7.1 if we currently dont have a remote desc
        peerConnection.setRemoteDescription(answer)
        // recap: initial peer, peer 1 sets llocaldescription and sends out the offer to peer 2
        // peer2 sets its own remote desc as the offer, and local desc as the answer its going to return to peer 1
        // and then peer1 upon getting the answer, needs to set its own remotedesc to the answer
    }
}
//10.leaveChannel shld be called anytime the user leaves
let leaveChannel = async () => {
    await channel.leave() // leave channel
    await client.logout() // logout as a user
}

// 12. adding functionalities for buttons in index.html
// 12.1 Toggle Camera fn
let toggleCamera = async () => {
    // look inside of localStream and loop thru all tracks, and look specifically for track with vidoe 
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')
    if(videoTrack.enabled){
        videoTrack.enabled = false // if video track currently enabled, we want to disable it. and turn off camera
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)' // set to red
    } else {
        // if currently not enabled
        videoTrack.enabled = true //enable video track
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)' // set to purple
    }
}

// 13.1 Toggle Mic fn
let toggleMic = async () => {
    // look inside of localStream and loop thru all tracks, and look specifically for track with audio 
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')
    if(audioTrack.enabled){
        audioTrack.enabled = false // if audio track currently enabled, we want to disable it. and turn off camera
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)' // set to red
    } else {
        // if currently not enabled
        audioTrack.enabled = true //enable audio track
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)' // set to purple
    }
}

// 10.1 ensure user leaves when their window actl closes
window.addEventListener('beforeunload',leaveChannel) // anytime a user closes the window, or close his laptop, then we leave channel

//12.2 add event listener for camera btn
document.getElementById('camera-btn').addEventListener('click',toggleCamera)

//13.2 add event listener for mic btn
document.getElementById('mic-btn').addEventListener('click',toggleMic)

init()

// connecting 2 peers together. sending offer to peer, along w ICE candidates


// need to set up STUN Server 
//- we r gonna use free stun server from google, 
//so we will set that up and pass it into our peer connection

