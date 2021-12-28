
# OpenGarage

Make your garage doors smarted in collaberation with Homey

## Prerequisites :man_mechanic:

- **OpenGarage device already setup, an IP address, Port and Device Key (default key is opendoor)**
- **Make sure your Homey is on the same network or can reach the IP address for the OpenGarage**
- **A static/fixed IP address for your OpenGarage is recommended**

## Pairing

When adding a OpenGarage device to your Homey you need to enter the IP address, port number and device key. 

## Settings

## Troubleshooting

 - Please file questions under issues if anyone is frequent I'll add them here

## Possible to-be-added features

 - Notification if device has not been online for a while
 - Increment probing time if device is no longer available to save on network requests
 
## Changelog

- 1.1.1
    - Updated to use new garage door capability. All old flows should still work but I recommend you to replace all cards referencing garage door with the new ones. 
    - Fixed the trigger "Vehicle state change" which never worked.
    - Added new settings which syncronizes with OpenGarage settings (to adjust door status measurement, vehicle measurement, alarm time e.t.c.)
    - Adjusted timings for when to poll status based on status updates + alarm time + given door opening time.
    - Cleaned up and published repo to github
    - Converted project to typescript
- 1.0.2
    - Bug which fixed problem when you had more than 1 door.
- 1.0.1
    - Added new pictures for app and product, some text modifications and hints added.
- 1.0.0
    - Initial release

## Links

[OpenGarage](https://opengarage.io/)

## Manual installation (Not for newbs)

```
npm install
sudo npm install --global --no-optional homey
touch app.json
homey app add-types
homey login
homey app install
```

## Running the emulator

```
npx ts-node OpenGarageEmulator/app.ts
```

Default port: 1987
Default device key: test

## Special Thanks

[Runely](https://github.com/runely) - I kinda stole this whole readme format from you, also used ur code for Remootio for reference when using the garagedoor capability.
