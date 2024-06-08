//
// powt.mjs by D.F.Mac.@TripArts Music
//

class powt {
  constructor(){
    this.wt = null;
    this.status = "disconnected";
    this.onBidiReceived = null;
    this.onDgramReceived = null;
    this.onStatusChange = null;
    this._bidiWriter = null;
    this._dgramWriter = null;
    this._bidiData = {
      progress:false,
      buffer:null,
      rSize:null,
      tSize:null
    };
  }
  available(){
    if(typeof WebTransport === 'function'){
      return true;
    }else{
      return false;
    }
  }
  connect(url){
    console.log("powt.connect()");
    return new Promise((resolve)=>{
      this.url = url;
      this.wt = new WebTransport(url,undefined);
      this.wt.closed.then(() => {
        console.log(`The QUIC connection to ${this.url} closed gracefully`);
        this.status = "disconnected";
        this._bidiWriter = null;
        this._dgramWriter = null;
        if(this.onStatusChange && typeof this.onStatusChange === 'function'){
          this.onStatusChange("disconnected");
        }
      }).catch((error) => {
        console.error(`the QUIC connection to ${this.url} closed due to ${error}`);
        this.status = "disconnected";
        this._bidiWriter = null;
        this._dgramWriter = null;
        if(this.onStatusChange && typeof this.onStatusChange === 'function'){
          this.onStatusChange("disconnected");
        }
      });
      this.wt.ready.then(async () => {
        this.status = "connected";
        this._bidiReadLooper().catch((e)=>{console.log("_bidiReadLooper closed : "+e)});
        this._dgramReadLooper().catch((e)=>{console.log("_dgramReadLooper closed : "+e)});
        this._dgramWriter = this.wt.datagrams.writable.getWriter();
        if(this.onStatusChange && typeof this.onStatusChange === 'function'){
          this.onStatusChange("connected");
        }
        resolve();
      }).catch((e) => {
        console.error(`reading stream error = ${e}`);
      });
    });
  }
  async _bidiReadLooper(){
    console.log("powt._bidiReadLooper()");
    const bidiReader = this.wt.incomingBidirectionalStreams.getReader();
    while (true) {
      const { done, value } = await bidiReader.read();
      if (done) {
        this._bidiWriter = null;
        break;
      }
      this._bidiWriter = value.writable.getWriter();
      await this._readBidiData(value.readable, this.onBidiReceived);
    }
  }
  async _dgramReadLooper(){
    console.log("powt._dgramReadLooper()");
    await this._readDgramData(this.wt.datagrams.readable, this.onDgramReceived);
  }
  async _readBidiData(receiveStream, func) {
    console.log("powt._readBidiData()");
    const reader = receiveStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("done");
        break;
      }
      if(this._bidiData.progress == false){
        let view = new DataView(value.buffer);
        let header = view.getUint32(0,true);
        if(header != 0xfefefefe){
          console.log("invalid header!");
          continue;
        }else{
          console.log("OK header!");
        }
        let totalLength = view.getUint32(4,true);
        console.log("totalLength="+totalLength+" value.length="+value.length)
        if(totalLength > value.length){
          this._bidiData.progress = true;
          this._bidiData.tSize = totalLength;
          this._bidiData.rSize = value.length;
          this._bidiData.buffer = new Uint8Array(totalLength);
          this._addUint8Arr(this._bidiData.buffer,0,value);
        }else{
          if(func && typeof func === 'function'){
            console.log(value);
            let databuff = value.subarray(8);
            func(databuff);
          }
        }
      }else{
        this._addUint8Arr(this._bidiData.buffer,this._bidiData.rSize,value);
        this._bidiData.rSize += value.length;
        if(this._bidiData.rSize >= this._bidiData.tSize){
          if(func && typeof func === 'function'){
            let databuff = this._bidiData.buffer.subarray(8);
            func(databuff);
          }
          this._bidiData.progress = false;
          this._bidiData.buffer = null;
          this._bidiData.tSize = null;
          this._bidiData.rSize = null;
        }
      }
    }
  }
  async _readDgramData(receiveStream, func) {
    console.log("powt._readDgramData()");
    const reader = receiveStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("done");
        break;
      }
      if(func && typeof func === 'function'){
        func(value);
      }
    }
  }
  async send(uint8Arry){
    console.log("powt.bidiSend()");
    if(this._bidiWriter != null){
      let arr = new ArrayBuffer(uint8Arry.length + 8);
      let buffer = new Uint8Array(arr);
      let view = new DataView(arr);
      view.setUint32(0,0xfefefefe,true);
      view.setUint32(4,uint8Arry.length+8,true);
      this._addUint8Arr(buffer,8,uint8Arry);
      await this._bidiWriter.write(buffer);
    }else{
      console.log("bidiWtiter Closed");
    }
  }
  async sendDgram(uint8Arry){
    console.log("powt.dgramSend()");
    if(this._dgramWriter != null){
      await this._dgramWriter.write(uint8Arry);
    }else{
      console.log("dgramWtiter Closed");
    }
  }
  close(){
    console.log("powt.close()");
    this.wt.close();
  }
  _addUint8Arr(buff,index,arr){
    console.log("powt._addUint8Arr buffSize="+buff.length+" index="+index+" arrSize="+arr.length);
    console.log("rest="+(buff.length - (index+arr.length)));
    let length = arr.length;
    let newIndex;
    for(let cnt=0;cnt<length;cnt++){
      newIndex = index+cnt;
      if(newIndex >= buff.length){
        console.log("overflow! break");
        break;
      }
      buff[newIndex] = arr[cnt];
    }
    newIndex++;
    console.log("newIndex="+newIndex);
    return newIndex;
  }
  on(event,_func){
    console.log("on() event="+event);
    let ev = event.toLowerCase();
    if(_func == undefined || typeof _func !== 'function'){
      console.log("on() parameter func undefned!");
      return null;
    }
    switch(ev){
    case "stream":
      this.onBidiReceived = _func;
      break;
    case "datagram":
    case "dgram":
      this.onDgramReceived = _func;
      break;
    case "statuschange":
    case "change":
    case "status":
      this.onStatusChange = _func;
      break;
    default:
      console.log("on() parameter event undefined!");
      return null;
    }
    return event;
  }
}

export default powt;
