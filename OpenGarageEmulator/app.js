const http = require('http');
const url = require('url');

const key = "test";
const jc = { dist: 20, door: 1, vehicle: 2, rcnt: 0, fwv: 110, name: "Emulator", mac: "FF:FF:FF:01:02:03", cid: 0, rssi: -65 };
const co = { result: 1, item: "" };
const jo = {"fwv":112,"sn1":0,"sn2":0,"sno":0,"dth":20,"vth":200,"riv":5,"alm":1,"aoo":0,"lsz":100,"tsn":0,"htp":80,"cdt":1000,"dri":500,"sfi":1,"cmr":10,"sto":0,"mod":42,"ati":30,"ato":0,"atib":3,"atob":0,"noto":3,"usi":0,"ssid":"MortensVei1IOT","auth":"","bdmn":"blynk-cloud.com","bprt":80,"name":"Volvo Garage","iftt":"","mqtt":"-.-.-.-","mqpt":1883,"mqur":"","mqtp":"Volvo Garage","dvip":"-.-.-.-","gwip":"-.-.-.-","subn":"255.255.255.0","dns1":"8.8.8.8","ntp1":"0.pool.ntp.org","host":"OG_9633DA"}
http.createServer((request, response) => {

  const parsedUrl = url.parse(request.url, true);
  const path = parsedUrl.pathname;
  const dkey = parsedUrl.query.dkey;

  console.log(`${new Date().toISOString()} - Request: ${path} - Query: ${JSON.stringify(parsedUrl.query)}`);

  response.writeHead(200, { 'Content-Type': 'application/json' });

  if (path == "/jc") {
    response.write(JSON.stringify(jc));
  }

  else if (path == "/co") {
    if(dkey == key) { co.result = 1; }
    else { co.result = 2; }
    response.write(JSON.stringify(co))
  }

  else if (path == "/cc") { 
    if (parsedUrl.query.open == 1) {
      jc.dist = 20;
      jc.vehicle = 2;
      jc.door = 1;
    } 
    else if (parsedUrl.query.close == 1) {
      jc.rcnt ++;

      jc.vehicle = jc.rcnt % 2;
      jc.dist = jc.vehicle == 1 ? 65 : 240;
      jc.door = 0;
    }
    co.result = 1;
    response.write(JSON.stringify(co));
  }

  else if (path == "/jo") {
    
    response.write(JSON.stringify(jo));

  }

  response.end();

}).listen(1987);
