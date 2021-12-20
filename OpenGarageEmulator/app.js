const http = require('http');
const url = require('url');

const key = "test";
const jc = { dist: 20, door: 1, vehicle: 2, rcnt: 0, fwv: 110, name: "Emulator", mac: "FF:FF:FF:01:02:03", cid: 0, rssi: -65 };
const co = { result: 1, item: "" };

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

  response.end();

}).listen(1987);
