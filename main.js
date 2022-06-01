// create variable for local stream and one for remote stream
// local stream - local camera's video and audio feed 
// remote stream - remote user's video and audio data
let localStream;
let remoteStream;
let peerConnection;

const servers = { // pass this object into RTCPeerConnection
    iceServers:[
        {
            urls:['stun:stun1.1.google.com:19302','stun:stun2.1.google.com:19302'] // copy the actl google stun servers into here
        } 
    ]
}

let init = async () => {
    //ask for permission to access our camera and video
    localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false}) // will req permission to our camera feed and audio
    // above, we want access to camera, but NOT audio

    document.getElementById('user-1').srcObject = localStream // video tag has a property called srcObject
    createOffer()
}

let createOffer = async () => {
    // create initial peerConnection
    peerConnection = new RTCPeerConnection(servers)

    // set up a media stream inside the user-2 video element
    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream 
    
    // Get my local tracks and add them to the peer connection.
    // we have our local stream alr. we need to loop thru our local stream's tracks andd add them to our peer connection
    // so that our remote peer can get them
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track,localStream) 
    }) // we are gonna add tracks to the peer connection

    // Listen for anytime when our remote peer adds tracks
    // anytime remote peer adds tracks , we want to add it to the peer connection and then listen to it
    peerConnection.ontrack =(event) => {
        // looping thru every single track frm our remote peer
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }
    // when we create a offer, we need to create ICE candidates as well
    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            //if its a candidate
            console.log('New ICE Candidate:',event.candidate)
        }

    }

    // each peer connection will have a offer and a answer
    //Create Offer
    let offer = await peerConnection.createOffer() 
    
    //Set local description
    await peerConnection.setLocalDescription(offer)
    // when we set the local description, its going to trigger the generation of ice candidates
    // will figure peerConn.onicecandidate
    console.log('Offer:',offer)

    // take offer along with each ice candidate generated, and sent this data to peer.
    // once remote peer gets this information, its going to create a SDP answer, and send back its infomration
    // once exchange is done, connection is completed
    // this process is done thru a process called signalling whr we get some users into a room tgt,
    // instead of using our own signalling server and using websockets manaully, we are gonna use Agora SDK to do this conveniently

}
init()

// connecting 2 peers together. sending offer to peer, along w ICE candidates


// need to set up STUN Server 
//- we r gonna use free stun server from google, 
//so we will set that up and pass it into our peer connection

