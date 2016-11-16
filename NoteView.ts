class NoteView {

    private noteTable : Object [];
    private velTable : Object [];

    constructor(noteInput: NoteInput) {
        this.noteTable = [];
        this.velTable = [];
        println(" INIT Note View")
        for (var i = 0; i < 128; i++) {
            this.noteTable.push(-1);
            this.velTable.push(i);
        }
        noteInput.setKeyTranslationTable(this.noteTable);
    }

}