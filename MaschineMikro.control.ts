
loadAPI(1);
load("NoteView.js")
load("Constants.js")

host.defineController("Native Instruments", "Maschine Mikro MK2", "1.0",
	"749beff0-f8d8-4e7f-8328-011625bd1b99", "Eric Ahrens")
host.defineMidiPorts(1, 1);
host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 In"],
	["Maschine Mikro MK2 Out"])

let __updateQueue = []
let __actions = 0
let __controllers: Controllers
let __colorTable : ColorTable  = new ColorTable()

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
	noteIn.setShouldConsumeEvents(false)

	let application = host.createApplication()
	__controllers = new Controllers()

	let noteView = new NoteView(noteIn)
	let transport = new Transport()
	let modeHandler = new GeneralModeHandler()

	let trackView = host.createCursorTrack(null, 8, 8)


	host.scheduleTask(handleSurfaceUpdate, null, 1)
	println(" ###### Maschine with Typescript ######## ")
	__controllers.buttonMatrix.init()
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

class GeneralModeHandler {
	private viewButton: Button
	private padButton: Button
	private scenButton: Button
	private patternButton: Button
	private groupButton: BasicColorButton

	private shiftButton: Button

	public shiftDown: boolean = false;

	constructor() {
		this.viewButton = __controllers.createButton(115)
		this.shiftButton = __controllers.createButton(80)
		this.padButton = __controllers.createButton(114)
		this.scenButton = __controllers.createButton(112)
		this.patternButton = __controllers.createButton(113)
		this.groupButton = __controllers.createBasicColorbutton(81)

		this.shiftButton.setCallback((value, button) => {
			this.shiftDown = value > 0
			button.sendValue(value)
		})

		this.groupButton.setCallback((value, button) => {
			if (value > 0) {
				this.groupButton.sendValue(30)
			} else {
				this.groupButton.sendValue(0)
			}
		})
	}
}

class Transport {
	private playButton: Button

	constructor() {
		this.playButton = __controllers.createButton(108);


		this.playButton.setCallback((value, button) => {
			button.sendValue(value > 0 ? 127 : 0)
		})
	}
}

class Controllers {
	private noteMapping = {}
	private controls: { [ccNr: number]: Button } = {};
	buttonMatrix: ButtonMatrix

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
					this.buttonMatrix.setColor(index, data2 > 0 ? 10 : 0)
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
	private index: number
	private row: number
	private col: number
	private base: number
	private midistatus: number

	constructor(parent: ButtonMatrix, index: number, base: number) {
		this.index = 0
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
