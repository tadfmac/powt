//
// log.mjs by D.F.Mac.@TripArts Music
//

class Log{
  constructor(dom){
    this.dom = null;
    if(dom){
      this.dom = dom;
    }    
  }
  out(text){
    let logText = "["+(getTime())+"] "+text;
    console.log(logText);
    if(this.dom){
      let child = document.createElement('div');
      child.innerHTML = logText;
      this.dom.insertBefore(child,this.dom.firstChild);
    }    
  }
}

function get2(number) {
  return ("0" + number).slice(-2);
};

function getTime(){
  let date = new Date();
  let y = date.getFullYear();
  let m = get2(date.getMonth() + 1);
  let d = get2(date.getDate());
  let time = get2(date.getHours());
  let min  = get2(date.getMinutes());
  let sec  = get2(date.getSeconds());
  return y+"/"+m+"/"+d+" "+time+":"+min+":"+sec;
}

export default Log;
