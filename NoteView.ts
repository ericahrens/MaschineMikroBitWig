class NoteView implements MatrixView {

    private noteTable: Object[];
    private velTable: Object[];
    private active = false;

    constructor(noteInput: NoteInput) {
        this.noteTable = [];
        this.velTable = [];
        for (var i = 0; i < 128; i++) {
            this.noteTable.push(-1);
            this.velTable.push(i);
        }
        noteInput.setKeyTranslationTable(this.noteTable);
    }

    notifyMainKnob(direction: number, pushState: boolean): void {
    }

    handleButtonEvent(button: ColorIndexButton, value: number): void {
        if (!this.active) {
            return;
        }
    }

    notifyShift(shiftDown: boolean): void {

    }
    
    enter(): void {
        this.active = true;
        //this.resendColors();
    }

    exit(): void {
        this.active = false;
    }

    blink(): void {
    }

}