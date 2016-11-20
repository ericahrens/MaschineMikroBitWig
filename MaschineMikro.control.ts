
loadAPI(1);
load("NoteView.js")
load("Constants.js")
load("ClipView.js")
load("VuView.js")
load("ApplicationControl.js")

host.defineController("Native Instruments", "Maschine Mikro MK2", "1.0",
	"749beff0-f8d8-4e7f-8328-011625bd1b99", "Eric Ahrens")
host.defineMidiPorts(1, 1);
host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 In"],
	["Maschine Mikro MK2 Out"])

let Orientation = {
    TrackBased : 0,
	SceneBased : 1
};
 
let __numTracks = 4
let __numScenes = 4
let __numSends = 8

let __updateQueue = []
let __actions = 0
let __controllers: Controllers
let __modeHandler: GeneralModeHandler
let __colorTable: ColorTable = new ColorTable()
let __clipOrientation = Orientation.TrackBased
let __currentMode: MatrixView
let __applicationControl : ApplicationControl

enum MIDI {
	CC = 11,
	NOTE = 9,
	PAT = 10
}

function init(): void {

	// Consider separate Noteins
	let noteIn = host.getMidiInPort(0).createNoteInput("Maschine Mikro MK2 In",
		"81????", "90????", "B1????", "D1????", "E1????", "A0????")
	host.getMidiInPort(0).setMidiCallback(onMidi)
	host.getMidiInPort(0).setSysexCallback(onSysex);
	noteIn.setShouldConsumeEvents(false)

	__applicationControl = new ApplicationControl()
	__controllers = new Controllers()
	__controllers.buttonMatrix.init()

	__modeHandler = new GeneralModeHandler(noteIn)

	let transport = new TransportHandler()

	host.scheduleTask(handleSurfaceUpdate, null, 1)
	println(" ###### Maschine with Typescript ######## ")
	handleblink();
}

/**
 * Task to handle Flashing
 */
function handleblink() {
	__currentMode.blink();
	host.scheduleTask(handleblink, null, 50);
}

function handleSurfaceUpdate(): void {
	__actions = 10;
	while (__updateQueue.length > 0 && __actions > 0) {
		var message = __updateQueue.shift();
		host.getMidiOutPort(0).sendMidi(message[0], message[1], message[2]);
		__actions--;
	}
	host.scheduleTask(handleSurfaceUpdate, null, 1)
}

function queueMidi(status, data1, data2): void {
	if (data2 === undefined) {
		println(" Undefined Midi Data ");
		return;
	}
	__updateQueue.push([status, data1, data2]);
}

function queueColor(color: number, control: number, value: number) {
	__updateQueue.push([0xB0 | color, control, value]);
}

function onMidi(status: number, data1: number, data2: number): void {
	if (__controllers.handleMidi(status, data1, data2)) {
		println(" Got Unmapped Midi  " + status + " " + data1 + " " + data2)
	}
}

function onSysex(data: string) {
	println(`Received SysEx ${data}`)
}

enum ModeType {
	Pad, Step, Clip, Scene, Vu
}

interface MatrixView extends ShiftResponder {
	enter() : void
	exit() : void
	handleButtonEvent(button: ColorIndexButton, value: number) : void
	blink() : void 
	notifyMainKnob(direction: number, pushState: boolean) : void
}

interface ShiftResponder {
	notifyShift(shiftDown: boolean) : void
}

interface EncoderHandler {
	handleEncoder(direction : number, pushDow: boolean) : void
}

class GeneralModeHandler {
	private viewButton: Button = __controllers.createButton(115)
	private padButton: Button = __controllers.createButton(114)
	private scenButton: Button = __controllers.createButton(112)
	private patternButton: Button = __controllers.createButton(113)
	private groupButton: BasicColorButton = __controllers.createBasicColorbutton(81)
	private eraseButton: Button = __controllers.createButton(110)
	private pushButton: Button = __controllers.createButton(85)
	private encoder: Button = __controllers.createButton(84)

	private shiftButton: Button = __controllers.createButton(80)

	private modeType: ModeType = ModeType.Clip;

	public shiftDown: boolean = false
	public pushDown: boolean = false
	public eraseDown: boolean = false

	private shiftResponders : Array<ShiftResponder> = [];
	private encoderHandler : Array<EncoderHandler> = [];

	private padView : NoteView;
	private clipView : ClipView;
	private vuView : VuView;

	constructor(noteInput: NoteInput) {
		let hostCursorTrack = host.createCursorTrack(null, 4, 8)
		let hostTrackBank = host.createMainTrackBank(__numTracks,__numSends,__numScenes);

		this.padView = new NoteView(noteInput);
		this.clipView = new ClipView(hostTrackBank);
		this.vuView = new VuView(hostTrackBank);

		__currentMode = this.clipView;
		this.clipView.enter();
		this.clipView.setIndication(true);

		this.encoder.setCallback((value, button) => {
			let direction = value == 1 ? 1 : -1;
			__currentMode.notifyMainKnob(direction, this.pushDown);
		});

		this.pushButton.setCallback((value, button) => {
			this.pushDown = value > 0
		})

		this.eraseButton.setCallback((value, button) => {
			this.eraseDown = value > 0
		})

		this.shiftButton.setCallback((value, button) => {
			this.shiftDown = value > 0
			button.sendValue(value)
			for(let responder of this.shiftResponders) {
				responder.notifyShift(this.shiftDown);
			}
		})

		this.padButton.setCallback((value, button) => {
			if (value > 0) {
				this.modeType = ModeType.Pad
				this.updateMode()
			}
		})

		this.scenButton.setCallback((value, button) => {
			if (value > 0) {
				this.modeType = ModeType.Scene
				this.updateMode()
			}
		})

		this.patternButton.setCallback((value, button) => {
			if (value > 0 && __currentMode != this.clipView) {
				__currentMode.exit()
				this.modeType = ModeType.Clip
				this.updateMode()
				__currentMode = this.clipView
				__currentMode.enter()
			}
		})

		this.viewButton.setCallback((value, button) => {
			if (value > 0 && __currentMode != this.vuView) {
				__currentMode.exit()
				this.modeType = ModeType.Vu
				this.updateMode()
				__currentMode = this.vuView
				__currentMode.enter()
			}
		})

		this.groupButton.setCallback((value, button) => {
			if (value > 0) {
				this.groupButton.sendValue(30)
			} else {
				this.groupButton.sendValue(0)
			}
		})
		this.updateMode();
	}

	addShiftResponder(responder: ShiftResponder) : void {
		this.shiftResponders.push(responder)
	}

	updateMode(): void {
		this.viewButton.sendValue(this.modeType == ModeType.Vu ? 127 : 0)
		this.padButton.sendValue(this.modeType == ModeType.Pad ? 127 : 0)
		this.scenButton.sendValue(this.modeType == ModeType.Scene ? 127 : 0)
		this.patternButton.sendValue(this.modeType == ModeType.Clip ? 127 : 0)
	}
}

class TransportHandler implements ShiftResponder, EncoderHandler {
	private playButton: Button = __controllers.createButton(108);
	private recButton: Button = __controllers.createButton(109);
	private transport: Transport = host.createTransport();

	private playing: boolean = false;
	private launchOverdub: boolean = false;

	constructor() {
		this.playButton.setCallback((value, button) => {
			if (value === 0) {
				return;
			}
			if (__modeHandler.shiftDown) {
				this.transport.stop();
			} else {
				this.transport.play();
			}
		})

		this.recButton.setCallback((value, button) => {
			if (value == 0) {
				return;
			}
			this.transport.toggleLauncherOverdub()
		});

		this.transport.addIsPlayingObserver((playing) => {
			this.playing = playing;
			if (playing) {
				this.playButton.sendValue(127)
			} else {
				this.playButton.sendValue(0)
			}
		});

		this.transport.addLauncherOverdubObserver((overdub) => {
			this.launchOverdub = overdub;
			this.recButton.sendValue(overdub ? 127 : 0)
		});

		__modeHandler.addShiftResponder(this)
	}

	handleEncoder(direction : number, pushDow: boolean) : void {
		
	}

	notifyShift(shiftDown: boolean) : void {
		println(`Got Shift <${shiftDown}>`);
	}
}

class Controllers {
	private noteMapping = {}
	private controls: { [ccNr: number]: Button } = {};
	buttonMatrix: ButtonMatrix
	//private matrixHandler : (button: ColorIndexButton, value: number) => void

	constructor() {
		this.buttonMatrix = new ButtonMatrix(this, 12);
	}

	createButton(ccNr: number): Button {
		let button = new Button(ccNr);
		this.controls[ccNr] = button;
		return button;
	}

	createBasicColorbutton(ccNr: number): BasicColorButton {
		let button = new BasicColorButton(ccNr);
		this.controls[ccNr] = button;
		return button;
	}

	fullUpdate(): void {
		for (let ccNr in this.controls) {
			this.controls[ccNr].resendLast();
		}
	}

	handleMidi(status: number, data1: number, data2: number): boolean {
		let channel = status & 0xF
		let type = status >> 4
		switch (type) {
			case 0xA: // Poly Aftertouch
				break;
			case 0xB: // MIDI CC
				if (data1 in this.controls) {
					this.controls[data1].action(data2)
					return false;
				} else {
					return true;
				}
			case 0x9: // MIDI Note
				if (data1 > 11 && data1 < 29) {
					let index = data1 - 12
					__currentMode.handleButtonEvent(this.buttonMatrix.getButton(index), data2);
					//this.buttonMatrix.setColor(index, data2 > 0 ? 60 : 0)
					return false
				}
				break;
		}
		return false
	}
}

interface Controller {
	sendValue(value: number): void
	reset(): void
}

class ColorIndexButton {
	private parent: ButtonMatrix
	private lastvalue: number = 0
	readonly index: number
	readonly row: number
	readonly col: number
	private base: number
	private midistatus: number

	constructor(parent: ButtonMatrix, index: number, base: number) {
		this.index = index
		this.base = base;
		this.col = this.index % 4
		this.row = Math.floor(this.index / 4)
		this.parent = parent
		this.midistatus = MIDI.NOTE << 4 | 0;
	}

	sendValue(value: number): void {
		if (value != this.lastvalue) {
			this.lastvalue = value
			queueMidi(this.midistatus, this.base, value);
		}
	}

	update(force: boolean = false): void {
		queueMidi(this.midistatus, this.base, this.lastvalue);
	}

}

class ColorButton {
	private parent: ButtonMatrix
	private hue: number = 50
	private sat: number = 127
	private bright: number = 0
	private index: number
	private row: number
	private col: number
	private base: number

	constructor(parent: ButtonMatrix, index: number, base: number) {
		this.index = 0
		this.base = base;
		this.col = this.index % 4
		this.row = Math.floor(this.index / 4)
		this.parent = parent
	}

	updateColor(hue: number, sat: number, bright: number): void {
		if (hue != this.hue) {
			this.hue = hue
			queueColor(0, this.base, this.hue)
		}
		if (sat != this.sat) {
			this.sat = sat
			queueColor(1, this.base, this.sat)
		}
		if (bright != this.bright) {
			this.bright = bright
			queueColor(2, this.base, this.bright)
		}
	}

	updateBright(value: number) {
		if (value != this.bright) {
			this.bright = value
			queueColor(2, this.base, this.bright)
		}
	}

	updateHue(value: number) {
		if (value != this.hue) {
			this.hue = value
			queueColor(0, this.base, this.hue)
		}
	}

	updateSat(value: number) {
		if (value != this.sat) {
			this.sat = value
			queueColor(1, this.base, this.sat)
		}
	}

	update(force: boolean = false): void {
		queueColor(0, this.base, this.hue)
		queueColor(1, this.base, this.sat)
		queueColor(2, this.base, this.bright)
	}
}


class ButtonMatrix {
	private parent: Controllers
	private basevalue: number
	private midistatus: number
	private buttons: ColorIndexButton[]

	constructor(parent: Controllers, basevalue: number) {
		this.parent = parent
		this.basevalue = basevalue
		this.midistatus = 0x90
		this.buttons = []
		for (let i = 0; i < 16; i++) {
			this.buttons.push(new ColorIndexButton(this, i, basevalue + i))
		}
	}

	getButton(index: number) : ColorIndexButton {
		return this.buttons[index]
	}

	setColor(index: number, value: number): void {
		this.buttons[index].sendValue(value);
	}

	setBrightness(index: number, brightness: number): void {
		if (index < 0 || index > 15) {
			return
		}
		//this.buttons[index].updateBright(brightness)
		this.buttons[index].sendValue(brightness)
	}

	//setColor(index: number, hue: number, sat: number, bright: number) {
	// this.buttons[index].updateColor(hue,sat,bright)
	//}

	init(): void {
		for (let i = 0; i < 16; i++) {
			this.buttons[i].update(true)
		}
	}
}

class Button implements Controller {

	protected midivalue: number;
	protected midistatus: number;
	private lastValue: number = -1
	private callback: (value: number, button: Button) => void;

	constructor(midivalue: number, channel: number = 0) {
		this.midivalue = midivalue;
		this.midistatus = MIDI.CC << 4 | channel;
	}

	action(value: number): void {
		if (this.callback) {
			this.callback(value, this);
		}
	}

	setCallback(callback: (value: number, button: Button) => void) {
		this.callback = callback;
	}

	sendValue(value: number): void {
		if (this.lastValue != value) {
			queueMidi(this.midistatus, this.midivalue, value)
		}
		this.lastValue = value
	}

	reset(): void {
		queueMidi(this.midistatus, this.midivalue, 0)
	}

	resendLast(): void {
		if (this.lastValue >= 0) {
			queueMidi(this.midistatus, this.midivalue, this.lastValue);
		}
	}
}

class BasicColorButton extends Button {
	private value: number = 0

	constructor(midivalue: number, channel: number = 0) {
		super(midivalue, channel)
	}


	sendValue(value: number): void {
		if (value != this.value) {
			this.value = value
			queueMidi(this.midistatus, this.midivalue, this.value);
		}
	}

	resendLast(): void {
		this.update();
	}

	update(force: boolean = false): void {
	}
}
