//
// powtserver.mjs by D.F.Mac.@TripArts Music
//

import { Http3Server } from "@fails-components/webtransport";
import { nanoid } from 'nanoid';
import LOG from "./www/log.mjs";

const Log = new LOG(null);

class powtServer {
  constructor(){
    Log.out("powtServer.constructor()");
    this.isKilled = false;
    this.sessions = {};
    this.onNewSession = null;
    this.onCloseSession = null;
    this.onBidiReceived = null;
    this.onDgramReceived = null;
  }
  start(config){
    Log.out("powtServer.start()");
    this.port = config.PORT;
    this.host = config.HOST;
    this.cert = config.cert;
    this.key  = config.key;
    this.path = config.path;
    this.h3Server = new Http3Server({
      port: config.PORT,
      host: config.HOST,
      secret: "changeit",
      cert: config.cert,
      privKey: config.key
    });
    this.h3Server.startServer();
    (async ()=>{
      await this.startSessionReader(this.path);
    })();
  }
  getSessionIds(){
    return Object.keys(this.sessions);
  }
  async startSessionReader(path){
    Log.out("powtServer.startSessionReader()");
    try{
      this.sessionStream = await this.h3Server.sessionStream(path);
      this.sessionReader = this.sessionStream.getReader();
      this.sessionReader.closed.catch((e) =>{
        Log.out("session reader closed with error!", e);
      });
      while(!this.isKilled){
        Log.out("sessionReader.read() - waiting for session...");
        const session = await this.sessionReader.read();
        Log.out("read new session !");
        if (session.done) {
          Log.out("done! break loop.");
          break;
        }

        session.value.closed.then(() => {
          Log.out("Session closed! id="+session._userData.id);
          delete this.sessions[session._userData.id];
          if(this.onCloseSession){
            this.onCloseSession(session._userData.id);
          }
        }).catch((e) => {
          Log.out("Session closed with error! " + e);
          delete this.sessions[session._userData.id];
          if(this.onCloseSession){
            this.onCloseSession(session._userData.id);
          }
        });

        session.value.ready.then(async () => {
          Log.out("session ready!");

          if(session._userData == undefined){
            session._userData = {};
            let idcandidate;
            for(;;){
              idcandidate = nanoid(8);
              if(this.sessions[idcandidate] == undefined){
                break;
              }
            }
            session._userData.id = idcandidate;
            Log.out("new session id="+session._userData.id);

            const bidi = await session.value.createBidirectionalStream().catch((e)=>{
               Log.out("failed to create bidirectional stream!", e);
            });

            session._userData.bidi = bidi;
            session._userData._bidiData = {
              progress:false,
              buffer:null,
              rSize:null,
              tSize:null
            };

            const writer = bidi.writable.getWriter();
            writer.closed.catch((e) => {
              Log.out("writer closed with error! : "+e);
              session._userData.bidiWriter = null;
            });
            session._userData.bidiWriter = writer;

            const reader = bidi.readable.getReader();
            reader.closed.catch((e) => {
              Log.out("reader closed with error! : "+e);
              session._userData.bidiReader = null;
            });
            session._userData.bidiReader = reader;

            this.bidiReadableWaiting(reader,session._userData.id).catch((e)=>{
              Log.out("bidireader closed with error! : "+e);
            });

            const dgramWriter = session.value.datagrams.writable.getWriter();
            dgramWriter.closed.then(() =>{
              Log.out("datagram writer closed successfully!");
              session._userData.dgramWriter = null;
            }).catch((e) => {
              Log.out("datagram writer closed with error! : "+e);  
            });
            session._userData.dgramWriter = dgramWriter;

            const dgramReader = session.value.datagrams.readable.getReader();
            dgramReader.closed.then(() =>{
              Log.out("datagram reader closed successfully!");
              session._userData.dgramReader = null;
            }).catch((e) => {
              Log.out("datagram reader closed with error! : "+e);  
            });

            this.dgramReadableWaiting(dgramReader,session._userData.id).catch((e)=>{
              Log.out("dgramReader closed with error! : "+e);
            });
            session._userData.dgramReader = dgramReader;

            this.sessions[session._userData.id] = session;
            if(this.onNewSession){
              this.onNewSession(session._userData.id);
            }
          }else{
            Log.out("session exists id="+session._userData.id);
          }
        }).catch((e) => {
          Log.out("session failed to be ready! : "+e);
        });
      }
    }catch(e){
      Log.out("startSessionReader failed : "+e);
    };
  }
  async send(id,uint8Arr){
    Log.out("powtServer.send() id="+id);
    if(this.sessions[id]){
      if(this.sessions[id]._userData.bidiWriter){
        let buffer = new Uint8Array(uint8Arr.length + 8);
        let view = new DataView(buffer.buffer);
        view.setUint32(0,0xfefefefe,true);
        view.setUint32(4,uint8Arr.length+8,true);
        this.addUint8Arr(buffer,8,uint8Arr);
        await this.sessions[id]._userData.bidiWriter.write(buffer).catch((e)=>{
          Log.out("send() write error : "+e);
        });;
        Log.out("powtServer.send() sent id="+id);     
      }else{
        Log.out("bidiWriter closed");
      }
    }else{
      Log.out("invalid id!");
    }
  }
  async sendDgram(id,uint8Arr){
    Log.out("powtServer.sendDgram() id="+id+" data="+uint8Arr);
    if(this.sessions[id]){
      if(this.sessions[id]._userData.dgramWriter){
        await this.sessions[id]._userData.dgramWriter.write(uint8Arr).catch((e)=>{
          Log.out("sendDgram() write error : "+e);
        });
        Log.out("powtServer.sendDgram() sent id="+id+" data="+uint8Arr);     
      }else{
        Log.out("dgramWriter closed");
      }
    }else{
      Log.out("invalid id!");
    }
  }
  async broadcast(uint8Arr,except){
    Log.out("powtServer.broadcast() except="+except);
    for(let id in this.sessions){
      if(id !== except){
        await this.send(id,uint8Arr);
      }
    }
  }
  async broadcastDgram(uint8Arr,except){
    Log.out("powtServer.broadcastDgram() except="+except);
    for(let id in this.sessions){
      if(id !== except){
        await this.sendDgram(id,uint8Arr);
      }
    }
  }
  async bidiReadableWaiting(reader,id){
    while(true){
      const { done, value } = await reader.read();
      if (done) {
        Log.out("done");
        break;
      }
      Log.out("bidi read----");

      if(this.sessions[id]._userData._bidiData.progress == false){
        let view = new DataView(value.buffer);
        let header = view.getUint32(0,true);
        if(header != 0xfefefefe){
          Log.out("invalid header!");
          continue;
        }else{
          Log.out("OK header!");
        }
        let totalLength = view.getUint32(4,true);
        Log.out("totalLength="+totalLength+" viewLength="+value.length);
        if(totalLength > value.length){
          this.sessions[id]._userData._bidiData.progress = true;
          this.sessions[id]._userData._bidiData.tSize = totalLength;
          this.sessions[id]._userData._bidiData.rSize = value.length;
          this.sessions[id]._userData._bidiData.buffer = new Uint8Array(totalLength);
          this.addUint8Arr(this.sessions[id]._userData._bidiData.buffer,0,value);
        }else{
          if(this.onBidiReceived != null){
            let databuff = value.subarray(8);
            this.onBidiReceived(databuff,id);
          }
        }
      }else{
        this.addUint8Arr(this.sessions[id]._userData._bidiData.buffer,this.sessions[id]._userData._bidiData.rSize,value);
        this.sessions[id]._userData._bidiData.rSize += value.length;
        if(this.sessions[id]._userData._bidiData.rSize >= this.sessions[id]._userData._bidiData.tSize){
          if(this.onBidiReceived != null){
            let databuff = this.sessions[id]._userData._bidiData.buffer.subarray(8);
            this.onBidiReceived(databuff,id);
          }
          this.sessions[id]._userData._bidiData.progress = false;
          this.sessions[id]._userData._bidiData.buffer = null;
          this.sessions[id]._userData._bidiData.tSize = null;
          this.sessions[id]._userData._bidiData.rSize = null;
        }
      }
    }
  }
  async dgramReadableWaiting(reader,id){
    while(true){
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      Log.out("dgram read----");
      if(this.onDgramReceived != null){
        this.onDgramReceived(value,id);
      }
    }
  }
  addUint8Arr(buff,index,arr){
    Log.out("powtServer.addUint8Arr buffSize="+buff.length+" index="+index+" arrSize="+arr.length);
    Log.out("rest="+(buff.length - (index+arr.length)));
    let length = arr.length;
    let newIndex;
    for(let cnt=0;cnt<length;cnt++){
      newIndex = index+cnt;
      if(newIndex >= buff.length){
        Log.out("overflow! break");
        break;
      }
      buff[newIndex] = arr[cnt];
    }
    newIndex++;
    Log.out("newIndex="+newIndex);
    return newIndex;
  }
}

export default new powtServer();
