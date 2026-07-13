# Satellite API Protocol

> **Quelle:** https://github.com/bitfocus/website/blob/main/for-developers/Satellite-API.md  
> **Zuletzt aktualisiert:** 2026-07-13 — API Version 1.12 / Companion 5.0+  
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
- `NONSQUARE` (since v1.11.0) true/false whether Companion supports rendering non-square buttons. You may wish to use this to adjust how some controls are exposed so that behave sensibly. You can report use non-square control dimensions in complex layouts without this, which will get black borders when needed to make up non-square bitmaps
- `BITMAP_FORMATS` (since v1.12.0) a comma-separated list of the bitmap encodings Companion can stream for button images, e.g. `rgb,png,webp`. `rgb` (raw 8-bit RGB pixel data) is always present as the universal fallback. A client opts into a compressed encoding by sending `BITMAP_FORMAT` in `ADD-DEVICE` or `ADD-SUB`; only formats listed here may be requested, and any other value falls back to `rgb`. See [Bitmap formats](#bitmap-formats-since-v1120).

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

- `DEVICEID` a unique identifier for this device within the current session. This is the routing key used to address the device in all subsequent messages. If `SERIAL` is not set, or talking to Companion before API v1.10.0, then this is used as the stable hardware serial number (See `SERIAL` below for more)
- `PRODUCT_NAME` is the name of the product to show in the Surfaces table in the UI

Optional parameters (all modes):

- `SERIAL` - (added in v1.10.0) the stable hardware serial number or other persistent identifier for this device. Companion uses this value to match the device to its stored configuration across sessions. If not provided, Companion falls back to using `DEVICEID` for config matching (preserving backward compatibility with older satellites). Recommended format is `type:identifier` (e.g. `streamdeck:AB12CD34`) to avoid collisions between device types.
- `SERIAL_IS_UNIQUE` - (added in v1.10.0) true/false whether the `SERIAL` value uniquely identifies a single physical device. Set to `false` when the hardware does not provide a unique serial number (e.g. some devices report a shared product ID instead of a per-unit serial). When `false`, Companion will not rely on the serial for persistent identification of this specific unit. (default true)
- `BRIGHTNESS` - (added in v1.7.0) true/false whether the device supporting changing brightness (default true)
- `VARIABLES` - (added in v1.7.0) a base64 encoded json array describing any input or output variables supported for this device  
   Each item in the array should be of the form:
  ```
  {
      "id": "some-id", // This is the identifier used when sending/receiving a value for the variable
      "type": "input", // or "output". When set to `input`, this is a value that the satellite device produces. When `output`, a value will be streamed to the satellite device
      "name": "My value", // A user facing name for this variable
      "description": "Something longer about it. eg Supports values in range 0-100", // A longer user facing description of this variable
  }
  ```
- `PINCODE_LOCK` - (added in v1.8.0) you can set to indicate that you will handle display of the pincode locked state. set to `FULL` to indicate that you will handle display and input or to `PARTIAL` to indicate that you will handle display and the user will not be able to input a pincode. (Partial mode has no difference in behaviour currently, but we will utilise it in the future)
- `CONFIG_FIELDS` - (added in v1.10.0) a base64-encoded JSON array of custom config field definitions to expose in the Companion UI for this device. See schema in [`assets/satellite-config-fields.schema.json`](https://github.com/bitfocus/companion/blob/main/assets/satellite-config-fields.schema.json). When provided, Companion will render these fields in the surface settings panel and push the stored values back to the device via `DEVICE-CONFIG` after the device is registered and again whenever the user changes them.
- `CAN_CHANGE_PAGE` - (added in v1.10.0) a label string indicating that the device is capable of initiating page changes (e.g. via a swipe gesture or dedicated page-up/down button). When provided, Companion adds a checkbox with this label to the surface settings panel, letting the user control whether the device is allowed to change pages. The device can then send `CHANGE-PAGE` messages to navigate between pages.
- `BITMAP_FORMAT` - (added in v1.12.0) the encoding Companion should use for streamed button bitmaps. Must be one of the values advertised in `BITMAP_FORMATS` in [`CAPS`](#capabilities) (`rgb`, `png` or `webp`). Defaults to `rgb` when omitted, or when set to a format that was not advertised. See [Bitmap formats](#bitmap-formats-since-v1120) for how this affects the `BITMAP` field in `KEY-STATE`.

##### Simple mode

Describe the surface as a flat grid of uniform buttons. All buttons share the same rendering settings.

- `KEYS_TOTAL` - number of keys the device has. (default 32) Valid values varies depending on API Version:
  - Since 1.5.1, this can be any integer value >= 1
  - Before 1.5.1, must be in the range 1-32
- `KEYS_PER_ROW` - number of keys per row. (default 8) Valid values varies depending on API Version:
  - Since 1.5.1, this can be any integer value >= 1
  - Before 1.5.1, must be in the range 1-8
- `BITMAPS` - This varies depending on API Version:
  - Since 1.5.0, this is a number specifying the desired size of the bitmaps. If 0 or false, then bitmaps will not be streamed. If 1 or true, they will be 72px (default 72)
  - Before 1.5.0, this is true/false whether you want to be streamed bitmaps for display on the buttons (default true)
- `COLORS` - This varies depending on API Version:
  - Since 1.6.0 true/false/'hex'/'rgb'
  - Before 1.6 true/false whether you want to be streamed colors for display on the buttons and in which format (default false).  
    If you specify true or 'hex', you'll get color readouts in hexadecimal notation, if you specify 'rgb', you'll get color readouts in css rgb notation without spaces.
- `TEXT` - true/false whether you want to be streamed button text for display on the buttons (default false)
- `TEXT_STYLE` - (added in v1.4.0) true/false whether you want to be streamed text style information for display on the buttons (default false)

In simple mode, `KEY-PRESS`, `KEY-ROTATE` and `KEY-STATE` use `KEY` to identify controls.

##### Advanced mode (since v1.9.0)

Describe a surface with individually configurable controls, where each control can have its own rendering settings. When `LAYOUT_MANIFEST` is provided, the simple mode parameters (`KEYS_TOTAL`, `KEYS_PER_ROW`, `BITMAPS`, `COLORS`, `TEXT`, `TEXT_STYLE`) are ignored. `KEY-PRESS`, `KEY-ROTATE` and `KEY-STATE` use `CONTROLID` to identify controls by the ID defined in the manifest.

- `LAYOUT_MANIFEST` - a base64-encoded JSON object describing the surface layout. The full schema is defined in [`assets/satellite-surface.schema.json`](https://github.com/bitfocus/companion/blob/main/assets/satellite-surface.schema.json).

The manifest has two top-level properties:

- `stylePresets` — a named map of rendering style presets. The `default` preset is required and is used as the fallback for any control that does not specify its own. Each preset can define:
  - `bitmap` — if set, bitmaps of the given pixel dimensions will be streamed, e.g. `{ "w": 72, "h": 72 }`
  - `colors` — stream colour data; `"hex"` for hexadecimal notation or `"rgb"` for CSS rgb notation
  - `text` — `true` to stream button text
  - `textStyle` — `true` to stream text style properties (e.g. font size)
- `controls` — a map of control IDs to their definitions. The ID (alphanumeric, `-`, `/`) is what gets used as `CONTROLID` in subsequent messages. Each entry defines:
  - `row` — zero-based row index (required)
  - `column` — zero-based column index (required)
  - `stylePreset` — name of a style preset to use for this control (optional, defaults to `default`)

Example manifest (before base64 encoding):

```json
{
  "stylePresets": {
    "default": { "bitmap": { "w": 72, "h": 72 }, "colors": "hex" },
    "encoder": { "colors": "hex" }
  },
  "controls": {
    "0/0": { "row": 0, "column": 0 },
    "0/1": { "row": 0, "column": 1 },
    "enc/0": { "row": 0, "column": 2, "stylePreset": "encoder" }
  }
}
```

#### Removing a satellite device

`REMOVE-DEVICE DEVICEID=00000`

- `DEVICEID` the unique identifier used to add the device

#### Pressing a key

Simple mode: `KEY-PRESS DEVICEID=00000 KEY=0 PRESSED=true`  
Advanced mode (since v1.9.0): `KEY-PRESS DEVICEID=00000 CONTROLID="0/0" PRESSED=true`

- `DEVICEID` the unique identifier used to add the device
- `KEY` (simple mode) number of the key which is pressed/released. Since v1.6 this can be either a legacy key number or the local row/column starting at top left with `0/0` and counting up towards bottom/right
- `CONTROLID` (advanced mode, since v1.9.0) the ID of the control as defined in the `LAYOUT_MANIFEST`
- `PRESSED` true/false whether the key is pressed

#### Rotating an encoder (Since v1.3.0)

Note: there is a checkbox to enable this per bank inside Companion, allowing users to define the actions to execute

Simple mode: `KEY-ROTATE DEVICEID=00000 KEY=0 DIRECTION=1`  
Advanced mode (since v1.9.0): `KEY-ROTATE DEVICEID=00000 CONTROLID="enc/0" DIRECTION=1`

- `DEVICEID` the unique identifier used to add the device
- `KEY` (simple mode) number of the key/encoder which is rotated. Since v1.6 this can be either a legacy key number or the local row/column starting at top left with `0/0` and counting up towards bottom/right
- `CONTROLID` (advanced mode, since v1.9.0) the ID of the control as defined in the `LAYOUT_MANIFEST`
- `DIRECTION` direction of the rotation. 1 for right, -1 for left

#### Updating a variable (Since v1.7.0)

This can be used when input variables are defined as part of `ADD-DEVICE`.

`SET-VARIABLE-VALUE DEVICEID=00000 VARIABLE="some-id" VALUE="abc="`

- `DEVICEID` the unique identifier used to add the device
- `VARIABLE` the id of the variable being updated
- `VALUE` the value of the variable, base64 encoded. The encoding is so that special characters and newlines don't have to be escaped, avoiding a wide range of easy to trigger bugs.

The success response echoes the variable name: `SET-VARIABLE-VALUE OK VARIABLE="some-id"` (since v1.7.1)

#### Pincode key press (Since v1.8.0)

When handling the pincode locked state yourself, report a pincode key was pressed

`PINCODE-KEY DEVICEID=00000 KEY=1`

- `DEVICEID` the unique identifier used to add the device
- `KEY` the value of the pressed key (0-9)

Note: depending on your surface, this may not translate directly to a button press.

#### Changing page (Since v1.10.0)

Request that Companion navigate the surface to the next or previous page. This message is only valid if `CAN_CHANGE_PAGE` was set when adding the device.

The request is silently ignored if the user has disabled the page-change checkbox for this surface in the settings UI. Companion will always respond with `OK`.

`CHANGE-PAGE DEVICEID=00000 DIRECTION=1`

- `DEVICEID` the unique identifier used to add the device
- `DIRECTION` direction to navigate. `1` for next page, `0` for previous page. Next/previous respects Companion's page order and any page restrictions configured for the surface group.

#### Firmware update available (Since v1.10.0)

Notify Companion that a firmware update is available (or no longer available) for this device. When `UPDATE_URL` is set to a non-empty value, Companion will show a firmware update indicator in the UI with a link to that URL. Set `UPDATE_URL` to an empty string to clear the update notification.

`FIRMWARE-UPDATE-INFO DEVICEID=00000 UPDATE_URL="https://example.com/firmware"`

`FIRMWARE-UPDATE-INFO DEVICEID=00000 UPDATE_URL=""`

- `DEVICEID` the unique identifier used to add the device
- `UPDATE_URL` URL to the firmware update page or download; set to empty string to clear the update notification

### Messages to receive

No responses are expected to these unless stated below, and to do so will result in an error.

#### State change for key

Simple mode: `KEY-STATE DEVICEID=00000 KEY=0 BITMAP=abcabcabc COLOR=#00ff00`  
Advanced mode (since v1.9.0): `KEY-STATE DEVICEID=00000 CONTROLID="0/0" BITMAP=abcabcabc COLOR=#00ff00`

- `DEVICEID` the unique identifier of the device
- `KEY` (simple mode) number of the key which the pixel buffer is for
- `CONTROLID` (advanced mode, since v1.9.0) the ID of the control as defined in the `LAYOUT_MANIFEST`
- `TYPE` type of the key. (added in v1.1.0) Either `BUTTON`, `PAGEUP`, `PAGEDOWN` or `PAGENUM`
- `PRESSED` true/false whether the key is currently held down. (added in v1.1.0)
- `LOCATION` (since v1.10.0) the absolute location of the button in the format `page/row/column` (e.g. `3/1/0`). This is sent for all button types, but is not always set.

Optional parameters (sent based on the control's resolved style preset):

- `BITMAP` button image data. Sent when the control's style preset has `bitmap` set (simple mode: when `BITMAPS` was enabled). Resolution follows the size defined in the style preset. The encoding depends on the `BITMAP_FORMAT` negotiated in `ADD-DEVICE` (since v1.12.0): when `rgb` (the default) this is base64-encoded raw 8-bit RGB pixel data; when `png` or `webp` this is a self-describing data url (e.g. `data:image/webp;base64,...`). See [Bitmap formats](#bitmap-formats-since-v1120).
- `COLOR` hex or css encoded 8-bit RGB color for the key background. Sent when the control's style preset has `colors` set (simple mode: when `COLORS` was set)
- `TEXTCOLOR` hex or css encoded 8-bit RGB color for the key text. Sent when the control's style preset has `colors` set (simple mode: when `COLORS` was set) (added in v1.6)
- `TEXT` base64 encoded text as should be displayed on the key. Sent when the control's style preset has `text` set (simple mode: when `TEXT` was true)
- `FONT_SIZE` numeric size that should be used when displaying the text on the key. Sent when the control's style preset has `textStyle` set (simple mode: when `TEXT_STYLE` was true) (added in v1.4.0)

Note: expect more parameters to be added to this message over time. Some could increase the frequency of the message being received.

#### Reset all keys to black

`KEYS-CLEAR DEVICEID=00000`

- `DEVICEID` the unique identifier of the device

#### Change brightness

`BRIGHTNESS DEVICEID=00000 VALUE=100`

- `DEVICEID` the unique identifier of the device
- `VALUE` brightness number in range 0-100

#### Update of a variable (Since v1.7.0)

This can be received when output variables are defined as part of `ADD-DEVICE`.

`VARIABLE-VALUE DEVICEID=00000 VARIABLE="some-id" VALUE="abc="`

- `DEVICEID` the unique identifier used to add the device
- `VARIABLE` the id of the variable being updated
- `VALUE` the value of the variable, base64 encoded. The encoding is so that special characters and newlines don't have to be escaped, avoiding a wide range of easy to trigger bugs.

#### Locked state update (Since v1.8.0)

This can be received when `PINCODE_LOCK` was specified when adding the device

`LOCKED-STATE DEVICEID=00000 LOCKED=true CHARACTER_COUNT=0`

- `DEVICEID` the unique identifier used to add the device
- `LOCKED` whether the surface is locked
- `CHARACTER_COUNT` how many characters have been entered for the pincode
- `ROTATION` (optional) the current rotation of the surface in degrees (0, 90, -90, 180) (added in v1.10.1)

Between this reporting `LOCKED=true` and `LOCKED=false`, you will not receive any other drawing messages, and any input messages you send will be ignored.

#### Device config update (Since v1.10.0)

Sent when `CONFIG_FIELDS` was declared in `ADD-DEVICE`. If your surface defines any config fields, Companion will send this message once immediately after the device is registered (`ADD-DEVICE OK`) and again whenever the user changes a config value in the UI.

`DEVICE-CONFIG DEVICEID=00000 CONFIG="eyJteS1maWVsZCI6InNvbWUtdmFsdWUifQ=="`

- `DEVICEID` the unique identifier used to add the device
- `CONFIG` base64-encoded JSON object where each key is a field `id` from `CONFIG_FIELDS` and the value is the current stored value for that field

## Button Subscriptions (Since v1.10.0)

The subscription API lets a client observe any individual button at an absolute location in Companion — without registering a surface. This is useful for custom UIs, secondary displays, or any scenario where you want to monitor or interact with a specific button rather than presenting a full surface to Companion.

Each subscription is identified by a client-chosen `SUBID`. The `SUBID` may contain alphanumeric characters, `-`, and `/` (the same rules as `CONTROLID`). It must be unique within the connection.

A location is expressed as `PAGE/ROW/COL` using Companion's native location syntax, e.g. `1/2/3` for page 1, row 2, column 3.

Subscribing to a location that does not contain a button is valid — Companion will respond with `OK` and immediately stream an empty button.

### Messages to send

#### Subscribe to a button

`ADD-SUB SUBID=myid LOCATION=1/2/3`

- `SUBID` unique identifier for this subscription, chosen by the client
- `LOCATION` the button location in `PAGE/ROW/COL` format
- `BITMAP_FORMAT` (since v1.12.0) the encoding Companion should use for streamed bitmaps. Must be one of the values advertised in `BITMAP_FORMATS` in [`CAPS`](#capabilities) (`rgb`, `png` or `webp`). Defaults to `rgb` when omitted or set to a format that was not advertised. Applies whether simple or advanced style is used. See [Bitmap formats](#bitmap-formats-since-v1120).

Two modes are available for specifying what should be streamed. At least one style option should be set for useful output.

##### Simple style

Flat parameters, mirrors the simple surface mode:

- `BITMAP` a number specifying the desired square bitmap size in pixels. If 0 or false, bitmaps will not be streamed.
- `COLORS` stream colour data; `hex` for hexadecimal notation or `rgb` for CSS rgb notation
- `TEXT` true/false whether you want button text streamed (default false)
- `TEXT_STYLE` true/false whether you want text style properties streamed (default false)

##### Advanced style

- `STYLE` a base64-encoded JSON object following the `SatelliteControlStylePreset` schema defined in [`assets/satellite-surface.schema.json`](https://github.com/bitfocus/companion/blob/main/assets/satellite-surface.schema.json). When `STYLE` is provided, the simple style parameters (`BITMAP`, `COLORS`, `TEXT`, `TEXT_STYLE`) are ignored.

The object can define:

- `bitmap` — if set, bitmaps of the given pixel dimensions will be streamed, e.g. `{ "w": 72, "h": 72 }`. Unlike the simple mode `BITMAP`, this allows non-square dimensions.
- `colors` — stream colour data; `"hex"` for hexadecimal notation or `"rgb"` for CSS rgb notation
- `text` — `true` to stream button text
- `textStyle` — `true` to stream text style properties (e.g. font size)

Example `STYLE` value (before base64 encoding):

```json
{ "bitmap": { "w": 72, "h": 72 }, "colors": "hex", "text": true }
```

This matches the json format used for the surface advanced mode.

Upon success, Companion immediately sends a `SUB-STATE` message with the current state of the button.

#### Unsubscribe from a button

`REMOVE-SUB SUBID=myid`

- `SUBID` the identifier of the subscription to remove

No further `SUB-STATE` messages will be sent for this `SUBID`.

#### Reporting a button press

`SUB-PRESS SUBID=myid PRESSED=true`

- `SUBID` the subscription identifier
- `PRESSED` true/false whether the button is pressed

#### Reporting an encoder rotation

`SUB-ROTATE SUBID=myid DIRECTION=1`

- `SUBID` the subscription identifier
- `DIRECTION` direction of the rotation. 1 for right, -1 for left

Note: there is a checkbox to enable rotation actions per button inside Companion, allowing users to define the actions to execute.

### Messages to receive

No response is expected to these messages.

#### Button state update

`SUB-STATE SUBID=myid TYPE=BUTTON`

Sent immediately after a successful `ADD-SUB` and again whenever the button's state changes.

- `SUBID` the subscription identifier
- `TYPE` type of the location. Either `BUTTON`, `PAGEUP`, `PAGEDOWN` or `PAGENUM`
- `PRESSED` true/false whether the button is currently held down.

Optional parameters (sent based on the style options specified in `ADD-SUB`):

- `BITMAP` button image data. Sent when `BITMAP` (or `bitmap` in advanced style) was set in `ADD-SUB`. Resolution matches the size requested. The encoding depends on the `BITMAP_FORMAT` negotiated in `ADD-SUB` (since v1.12.0): when `rgb` (the default) this is base64-encoded raw 8-bit RGB pixel data; when `png` or `webp` this is a self-describing data url (e.g. `data:image/png;base64,...`). See [Bitmap formats](#bitmap-formats-since-v1120).
- `COLOR` hex or css encoded 8-bit RGB color for the button background. Sent when `COLORS` was set in `ADD-SUB`.
- `TEXTCOLOR` hex or css encoded 8-bit RGB color for the button text. Sent when `COLORS` was set in `ADD-SUB`.
- `TEXT` base64 encoded text as should be displayed on the button. Sent when `TEXT=true` was set in `ADD-SUB`.
- `FONT_SIZE` numeric size that should be used when displaying the text on the button. Sent when `TEXT_STYLE=true` was set in `ADD-SUB`.

Note: expect more parameters to be added to this message over time. Some could increase the frequency of the message being received.

## Bitmap formats (Since v1.12.0)

By default, button bitmaps are streamed as raw 8-bit RGB pixel data, base64 encoded. From v1.12.0, a client can instead negotiate a compressed image encoding, which can significantly reduce the amount of data sent for each button update.

### Negotiation

1. On connection, Companion advertises the encodings it can produce in the `BITMAP_FORMATS` field of the [`CAPS`](#capabilities) message, e.g. `BITMAP_FORMATS=rgb,png,webp`. `rgb` is always present as the universal fallback.
2. The client requests one of these encodings via the `BITMAP_FORMAT` parameter when registering a surface (`ADD-DEVICE`) or a subscription (`ADD-SUB`).
3. Companion streams the `BITMAP` field of `KEY-STATE`/`SUB-STATE` using the negotiated encoding.

If `BITMAP_FORMAT` is omitted, or set to a value that was not advertised in `BITMAP_FORMATS`, Companion falls back to `rgb`. This keeps older satellites — which never send `BITMAP_FORMAT` and have no image decoder — working unchanged. Servers older than v1.12.0 do not send `BITMAP_FORMATS` and ignore `BITMAP_FORMAT`; such clients always receive `rgb`.

### Available formats

- `rgb` — raw 8-bit RGB pixel data, base64 encoded. The `BITMAP` field is the bare base64 string.
- `png` — PNG image, encoded losslessly.
- `webp` — WebP image, encoded losslessly.

`png` and `webp` are encoded losslessly, so the decoded image is pixel-identical to the equivalent `rgb` buffer.

### Distinguishing the encoding on receipt

When a compressed format is used, the `BITMAP` field is a self-describing [data url](https://developer.mozilla.org/en-US/docs/Web/URI/Schemes/data) (e.g. `data:image/webp;base64,...`), rather than a bare base64 string. A client can therefore tell raw rgb apart from a compressed image by checking for the `data:` prefix, which is useful if your client may receive either encoding (for example across reconnects).
