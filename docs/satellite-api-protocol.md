# Satellite API Protocol

> **Quelle:** https://github.com/bitfocus/website/blob/main/for-developers/Satellite-API.md  
> **Zuletzt aktualisiert:** 2026-04-05 — API Version 1.10 / Companion 4.3+  
> **Update-Hinweis:** Neu fetchen wenn Companion Major-Version steigt oder API-Version sich ändert.  
> Befehl: `gh api "repos/bitfocus/website/contents/for-developers/Satellite-API.md" --jq '.content' | base64 -d > docs/satellite-api-protocol.md`

---

It is possible to remotely connect a 'Stream Deck' to companion so that it appears as its own device and follows the paging model. This is different from how the OSC/TCP/UDP servers operate.

This page documents the protocol. The intention is to only ever add non-breaking functionality to this API, and to keep this document updated with new functionality as it is added.

## Companion version support

This lists what versions of Companion introduced support for each API version.

| API Version | Companion Versions |
| ----------- | ------------------ |
| 1.4         | v3.0+              |
| 1.5         | v3.2+              |
| 1.7         | v3.4+              |
| 1.8         | v4.0+              |
| 1.9         | v4.2+              |
| 1.10        | v4.3+              |

## Connection

The server by default runs on port TCP 16622, but this will become configurable in the future. You should make sure to support alternate ports to allow for future compatibility as well as firewalls or router port forwarding.  
As of Companion 3.5, it is also possible to use this protocol over websockets, with a default port of 16623.

Each message is presented as a line, with a `\n` or `\r\n` terminator.  
Messages follow the general format of `COMMAND-NAME ARG1=VAL1 ARG2=true ARG3="VAL3 with spaces"\n`.
Key numbers are in the range of 0-31.

Note: You can send boolean values can as both true/false and 0/1, you will always receive them as 0/1

Upon connection you will receive `BEGIN CompanionVersion=2.2.0-d9008309-3449 ApiVersion=1.0.0` stating the build of companion you are connected to. The `CompanionVersion` field should not be relied on to be meaningful to your application, but can be presented as information to the user, or to aid debugging. You should use the `ApiVersion` field to check compatibility with companion. The number followers [semver](https://semver.org/) for versioning. We hope to keep breaking changes to a minimum, and will do so only when necessary.

On servers that support it (since v1.10.0), `BEGIN` is immediately followed by a `CAPS` message declaring which optional features are available. See [Capabilities](#capabilities) below.

### Messages to send

Upon receiving an unknown command, the server will respond with the format `ERROR MESSAGE="Unknown command: SOMETHING"`  
Known commands will get either a success or error response like the following:

- `COMMAND-NAME ERROR MESSAGE="Some text here"\n`
- `COMMAND-NAME ERROR DEVICEID=00000 MESSAGE="Some text here"\n` (since v1.2.0, `DEVICEID` is included when it is known)
- `COMMAND-NAME OK\n`
- `COMMAND-NAME OK ARG1=arg1\n`

#### Close connection

`QUIT`
Close the connection, removing all registered devices

#### Ping/pong

`PING payload`
Check the server is alive, with an arbitrary payload
Responds with `PONG payload`  
You must call this at an interval, we recommend every 2 seconds, this is to ensure the connection doesn't get closed from being idle.

### Messages to receive

No responses are expected to these unless stated below, and to do so will result in an error.

#### Ping/pong

`PING payload`
The server is checking you are still alive, with an arbitrary payload
You must respond with `PONG payload`

#### Capabilities (Since v1.10.0) {#capabilities}

`CAPS SUBSCRIPTIONS=1`

Sent by the server immediately after `BEGIN`, before any other messages. Declares which optional features are available in this session. If a flag is absent, the client should treat it as disabled.

- `SUBSCRIPTIONS` true/false whether the [Button Subscription](#button-subscriptions-since-v1100) API (`ADD-SUB`, `REMOVE-SUB`, `SUB-PRESS`, `SUB-ROTATE`, `SUB-STATE`) is available

If the server changes the availability of an optional feature at runtime, it will close the connection. The client should reconnect and re-read the new `CAPS` message.

Note: servers older than v1.10.0 do not send `CAPS`. Clients should rely solely on the `ApiVersion` from `BEGIN` to determine whether a feature exists at all; `CAPS` only needs to be checked for features that may be conditionally disabled within a version that otherwise supports them.

## Surfaces

The surface API is the primary way to use the Satellite protocol. It lets your client register one or more virtual surfaces with Companion — each surface appears in the Surfaces table in the UI just like a physical device, follows Companion's page model, and receives streamed button state updates (bitmaps, colours, text) that your client is responsible for rendering.

Two modes are available when registering a surface:

- **Simple mode** — a flat uniform grid of buttons with shared rendering settings. Easiest to implement and sufficient for most use cases.
- **Advanced mode** (since v1.9.0) — individually configurable controls, each with its own rendering style. Suited for mixed surfaces such as a grid of buttons alongside encoders.

Once a surface is registered with `ADD-DEVICE`, Companion will begin streaming `KEY-STATE` updates for every button on the surface. Your client reports user interactions (button presses, encoder rotations) back to Companion using `KEY-PRESS` and `KEY-ROTATE`.

### Messages to send

#### Adding a satellite device

When adding a device, you need to choose between a simple and advanced mode. The advanced mode allows finer grained control definitions, but requires a bit more work. The simple mode is more basic but is sufficient for many use cases and is easier to implement.

`ADD-DEVICE DEVICEID=00000 PRODUCT_NAME="Satellite Streamdeck"`

- `DEVICEID` should be a unique identifier for the hardware device. such as a serial number, or mac address. This should be in the format `streamdeck:12345` to both ensure there aren't collisions between device types, and make the id a bit more meaningful.
- `PRODUCT_NAME` is the name of the product to show in the Surfaces table in the UI

Optional parameters (all modes):

- `BRIGHTNESS` - (added in v1.7.0) true/false whether the device supporting changing brightness (default true)
- `VARIABLES` - (added in v1.7.0) a base64 encoded json array describing any input or output variables supported for this device  
   Each item in the array should be of the form:
  ```
  {
      "id": "some-id",
      "type": "input", // or "output"
      "name": "My value",
      "description": "Something longer about it. eg Supports values in range 0-100",
  }
  ```
- `PINCODE_LOCK` - (added in v1.8.0) set to `FULL` or `PARTIAL` to handle pincode locked state display

##### Simple mode

- `KEYS_TOTAL` - number of keys (default 32, any integer >= 1 since v1.5.1)
- `KEYS_PER_ROW` - number of keys per row (default 8, any integer >= 1 since v1.5.1)
- `BITMAPS` - pixel size of bitmaps (0=off, number=size in px, default 72; before v1.5.0: true/false)
- `COLORS` - since v1.6.0: true/false/'hex'/'rgb' (hex/true → hex notation, rgb → css rgb without spaces)
- `TEXT` - true/false whether to stream button text (default false)
- `TEXT_STYLE` - (added in v1.4.0) true/false whether to stream text style info (default false)

In simple mode, `KEY-PRESS`, `KEY-ROTATE` and `KEY-STATE` use `KEY` to identify controls.

##### Advanced mode (since v1.9.0)

When `LAYOUT_MANIFEST` is provided, simple mode parameters are ignored. Uses `CONTROLID` instead of `KEY`.

- `LAYOUT_MANIFEST` - base64-encoded JSON object (schema: `assets/satellite-surface.schema.json`)

#### Removing a satellite device

`REMOVE-DEVICE DEVICEID=00000`

#### Pressing a key

Simple mode: `KEY-PRESS DEVICEID=00000 KEY=0 PRESSED=true`  
Advanced mode (since v1.9.0): `KEY-PRESS DEVICEID=00000 CONTROLID="0/0" PRESSED=true`

Since v1.6, `KEY` can be either a legacy key number or `row/column` (e.g. `0/0`).

#### Rotating an encoder (Since v1.3.0)

Simple mode: `KEY-ROTATE DEVICEID=00000 KEY=0 DIRECTION=1`  
Advanced mode (since v1.9.0): `KEY-ROTATE DEVICEID=00000 CONTROLID="enc/0" DIRECTION=1`

- `DIRECTION` 1 for right, -1 for left

#### Updating a variable (Since v1.7.0)

`SET-VARIABLE-VALUE DEVICEID=00000 VARIABLE="some-id" VALUE="abc="`

- `VALUE` is base64 encoded

#### Pincode key press (Since v1.8.0)

`PINCODE-KEY DEVICEID=00000 KEY=1`

### Messages to receive

#### State change for key

Simple mode: `KEY-STATE DEVICEID=00000 KEY=0 BITMAP=abcabcabc COLOR=#00ff00`  
Advanced mode (since v1.9.0): `KEY-STATE DEVICEID=00000 CONTROLID="0/0" BITMAP=abcabcabc COLOR=#00ff00`

- `TYPE` — `BUTTON`, `PAGEUP`, `PAGEDOWN` or `PAGENUM` (since v1.1.0)
- `PRESSED` — true/false (since v1.1.0)
- `LOCATION` — absolute location `page/row/column` e.g. `3/1/0` (since v1.10.0)
- `BITMAP` — base64 encoded 8-bit RGB pixel data
- `COLOR` — hex or css RGB background color
- `TEXTCOLOR` — hex or css RGB text color (since v1.6)
- `TEXT` — base64 encoded button text
- `FONT_SIZE` — numeric font size (since v1.4.0)

#### Reset all keys to black

`KEYS-CLEAR DEVICEID=00000`

#### Change brightness

`BRIGHTNESS DEVICEID=00000 VALUE=100`

#### Update of a variable (Since v1.7.0)

`VARIABLE-VALUE DEVICEID=00000 VARIABLE="some-id" VALUE="abc="`

#### Locked state update (Since v1.8.0)

`LOCKED-STATE DEVICEID=00000 LOCKED=true CHARACTER_COUNT=0`

## Button Subscriptions (Since v1.10.0)

Monitor individual buttons at absolute locations without registering a surface. Each subscription has a client-chosen `SUBID` (alphanumeric, `-`, `/`). Location format: `PAGE/ROW/COL` (e.g. `1/2/3`).

### Messages to send

#### Subscribe to a button

`ADD-SUB SUBID=myid LOCATION=1/2/3`

##### Simple style parameters

- `BITMAP` — square bitmap size in pixels (0 = off)
- `COLORS` — `hex` or `rgb`
- `TEXT` — true/false
- `TEXT_STYLE` — true/false

##### Advanced style

- `STYLE` — base64-encoded JSON `SatelliteControlStylePreset` object

Example (before base64):
```json
{ "bitmap": { "w": 72, "h": 72 }, "colors": "hex", "text": true }
```

Upon success, Companion immediately sends a `SUB-STATE` with the current button state.

#### Unsubscribe from a button

`REMOVE-SUB SUBID=myid`

#### Reporting a button press

`SUB-PRESS SUBID=myid PRESSED=true`

#### Reporting an encoder rotation

`SUB-ROTATE SUBID=myid DIRECTION=1`

### Messages to receive

#### Button state update

`SUB-STATE SUBID=myid TYPE=BUTTON`

Sent immediately after `ADD-SUB` and on every state change.

- `SUBID` — subscription identifier
- `TYPE` — `BUTTON`, `PAGEUP`, `PAGEDOWN` or `PAGENUM`
- `PRESSED` — true/false
- `BITMAP` — base64 encoded 8-bit RGB pixel data (when `BITMAP` set in `ADD-SUB`)
- `COLOR` — hex or css RGB background color (when `COLORS` set)
- `TEXTCOLOR` — hex or css RGB text color (when `COLORS` set)
- `TEXT` — base64 encoded button text (when `TEXT=true`)
- `FONT_SIZE` — numeric font size (when `TEXT_STYLE=true`)
