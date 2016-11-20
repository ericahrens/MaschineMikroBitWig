class ClipView implements MatrixView {
    private trackBank: TrackBank
    private active: boolean
    private playStates: Array<PlayState> = []
    private trackStates: Array<TrackViewState> = []
    private flashCount = 0
    private blinkstate = 0

    constructor(trackBank: TrackBank) {
        this.trackBank = trackBank
        this.playStates = [];

        (() => {
            for (let i = 0; i < 4; i++) {
                this.trackStates.push(new TrackViewState());
            }
        })();
        for (let i = 0; i < 4; i++) {
            this.registerTrack(trackBank.getChannel(i), i);
        }
        for (let i = 0; i < 16; i++) {
            this.playStates.push(new PlayState());
        }
    }

    private toIndex(trackIndex: number, sceneIndex: number): number {
        return __clipOrientation === Orientation.TrackBased ? (3 - trackIndex) * 4 + sceneIndex : (3 - sceneIndex) * 4 + trackIndex;
    };

    private sendMidi = function (index: number, color: number, queued: boolean = true, force: boolean = false) {
        if (!this.active) {
            return;
        }
        __controllers.buttonMatrix.setColor(index, color);
    };

    notifyMainKnob(direction: number, pushState: boolean): void {
        //println(`Encoder Turn <${direction}> <${pushState}>`)
        let mod1 = pushState
        if (mod1) {
            if (direction > 0) {
                if (__clipOrientation === Orientation.TrackBased) {
                    this.trackBank.scrollScenesDown()
                } else {
                    this.trackBank.scrollChannelsDown()
                }
            } else {
                if (__clipOrientation === Orientation.TrackBased) {
                    this.trackBank.scrollScenesUp()
                } else {
                    this.trackBank.scrollChannelsUp()
                }
            }
        } else {
            if (direction > 0) {
                if (__clipOrientation === Orientation.TrackBased) {
                    this.trackBank.scrollChannelsDown()
                } else {
                    this.trackBank.scrollScenesDown()
                }
            } else {
                if (__clipOrientation === Orientation.TrackBased) {
                    this.trackBank.scrollChannelsUp()
                } else {
                    this.trackBank.scrollScenesUp()
                }
            }
        }
    }

    private registerTrack(track: Track, tindex: number) {
        var slot = track.getClipLauncherSlots();

        slot.addColorObserver((sindex, red, green, blue) => {
            var _index = this.toIndex(sindex, tindex);
            this.playStates[_index].basecolor = __colorTable.convertColor(red, green, blue);
            this.sendMidi(_index, this.playStates[_index].color())
        });

        slot.addHasContentObserver((sindex, hascontent) => {
            var _index = this.toIndex(sindex, tindex);
            var _state = this.playStates[_index];
            _state.hascontent = hascontent;
        });

        slot.addIsPlayingObserver((sindex, playing) => {
            var _index = this.toIndex(sindex, tindex);
            var _state = this.playStates[_index];
            _state.playing = playing;
        });
        slot.addIsSelectedObserver((sindex, isselected) => {
            var _index = this.toIndex(sindex, tindex);
            var _state = this.playStates[_index];
            _state.selected = isselected;
        });

        slot.addPlaybackStateObserver((sindex, state, queued) => {
            var _index = this.toIndex(sindex, tindex);
            var _state = this.playStates[_index];
            var prev_flash = _state.isFlashing();

            _state.setPlayState(state, queued);
            this.sendMidi(_index, _state.color());
            if (prev_flash !== _state.isFlashing()) {
                if (!prev_flash) {
                    this.flashCount++;
                } else {
                    this.flashCount--;
                }
            }
        });


        track.getArm().addValueObserver((val: boolean) => {
            this.trackStates[tindex].armed = val;
        });
        track.getSolo().addValueObserver((val: boolean) => {
            this.trackStates[tindex].solo = val;
        });
        track.getMute().addValueObserver((val: boolean) => {
            this.trackStates[tindex].mute = val;
        });
        track.exists().addValueObserver((val: boolean) => {
            this.trackStates[tindex].exists = val;
        });
        track.addIsSelectedInMixerObserver((val: boolean) => {
            this.trackStates[tindex].selected = val;
        });
    }

    enter(): void {
        this.active = true;
        this.resendColors();
    }

    exit(): void {
        this.active = false;
    }

    blink(): void {
        this.blinkstate = (this.blinkstate + 1) % 8;
        if (this.flashCount === 0) {
            return;
        }

        for (var i = 0; i < 16; i++) {
            var state = this.playStates[i];
            switch (state.getFlashState()) {
                case FlashState.QUEUED: //
                    if (this.blinkstate > 3) {
                        this.sendMidi(i, state.color() + 3);
                    } else {
                        this.sendMidi(i, state.color());
                    }
                    break;
                case FlashState.REC:
                    if (this.blinkstate > 3) {
                        this.sendMidi(i, 0 + 3);
                    } else {
                        this.sendMidi(i, state.color());
                    }
                    break;
                case FlashState.RECQUEUE:
                    if ((this.blinkstate % 4) > 1) {
                        this.sendMidi(i, 0 + 3);
                    } else {
                        this.sendMidi(i, state.color());
                    }
                    break;
            }
        }
    }

    resendColors = function () {
        if (!this.active) {
            return;
        }
        for (var i = 0; i < 16; i++) {
            this.sendMidi(i, this.playStates[i].color());
        }
    };

    setIndication(active: boolean) {
        for (var i = 0; i < 4; i++) {
            this.trackBank.getChannel(i).getClipLauncherSlots().setIndication(active);
        }
    }

    handleButtonEvent(button: ColorIndexButton, value: number): void {
        if (!this.active) {
            return;
        }
        if (value === 0) {
            return;
        }
        let rowt = __clipOrientation === Orientation.TrackBased ? button.row : button.col;
        let colt = __clipOrientation === Orientation.TrackBased ? button.col : button.row;
        let _index = rowt * 4 + colt;
        let selectAndLaunch = true;
		/* if (modifiers.isShiftDown()) {
			applicationControl.exec(row * 8 + col);
			return;
		}*/

		/*if (!trackStates[colt].exists || !sceneStates[rowt]) {
			return;
		} */
        let track = this.trackBank.getChannel(colt);
        let slots = track.getClipLauncherSlots();

        var state = this.playStates[_index];

        if (__modeHandler.eraseDown) {
            if (state.hascontent) {
                slots.deleteClip(3 - rowt);
            }
            return;
        }

        //println(" T: " + trackStates[colt].armed );
        //eprintln(" STATE > " + state.info());
        if (state.hascontent) {
            if (state.playing || state.isQueued()) {
                slots.stop();
            } else {
                slots.launch(3 - rowt);
                if (selectAndLaunch) {
                    slots.select(3 - rowt);
                }
            }
        }
        else {
            // println(`SELECT ${button.row} ${button.col} ${button.index} = ${_index} hascontent=> ${state.hascontent} playing= ${state.playing}`)
            if (this.trackStates[colt].armed) {
                slots.createEmptyClip(3 - rowt, 4.0);
                slots.launch(rowt);
                if (selectAndLaunch) {
                    slots.select(rowt);
                }
                __applicationControl.showNoteEditor();
                slots.showInEditor(3 - rowt);
                __applicationControl.getApplication().focusPanelBelow();
                __applicationControl.getApplication().zoomToFit();
            } else {
                slots.createEmptyClip(3 - rowt, 4.0);
                if (selectAndLaunch) {
                    slots.select(3 - rowt);
                }
                __applicationControl.showNoteEditor();
                slots.showInEditor(rowt);
                __applicationControl.getApplication().focusPanelBelow();
                __applicationControl.getApplication().zoomToFit();
            }
        }
    }

    notifyShift(shiftDown: boolean): void {

    }
}

class PlayState {
    pstate: number = 0;
    queued = false;
    basecolor = 0;
    hascontent = false;
    playing = false;
    flashing = false;
    private flashState = FlashState.NONE;
    exists = false;
    selected = false;

    color(): number {
        if (this.basecolor === 0) {
            return 0;
        }
        if (this.playing || this.pstate === 2) {
            return this.basecolor + 2;
        }
        return this.basecolor;
    };

    setPlayState = function (pState: number, pQueued: boolean): void {
        this.pstate = pState;
        this.queued = pQueued;
        if (this.pstate === 2) {
            this.flashing = true;
            this.flashState = this.queued ? FlashState.RECQUEUE : FlashState.REC;
        } else {
            if (this.pstate === 0 && this.queued) {
                this.flashing = false;
            } else {
                this.flashing = this.queued;
            }
            this.flashState = this.flashing ? FlashState.QUEUED : FlashState.NONE;
        }
    }

    getFlashState(): FlashState {
        return this.flashState;
    }

    isFlashing() {
        return this.flashing;
    }

    isRecording() {
        return this.pstate === 2;
    }

    isQueued() {
        return this.queued;
    }

    info() {
        return "Q: " + this.queued + " S:" + this.pstate + " Contents=" + this.hascontent + " Play=" + this.playing + " Exist=" + this.exists;
    }
}

var TrackViewModes = {
    FORCE_ARM: 0,
    SELECT: 1,
    MUTE: 2,
    SOLO: 3,
    ARM: 4
};

class TrackViewState {
    armed = false;
    exists = false;
    basecolor = 0;
    selected = false;
    mute = false;
    solo = false;

    color(mode): number {
        if (!this.exists) {
            return 0;
        }
        switch (mode) {
            case TrackViewModes.SELECT:
                return this.basecolor + (this.selected ? 2 : 0);
            case TrackViewModes.MUTE:
                return 12 + (this.mute ? 2 : 0);
            case TrackViewModes.SOLO:
                return 20 + (this.solo ? 2 : 0);
            case TrackViewModes.ARM:
                return 4 + (this.armed ? 2 : 0);
        }
    }
}