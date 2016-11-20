class ApplicationControl {
    private application: Application;

    constructor() {
        this.application = host.createApplication();
    }

    getApplication(): Application {
        return this.application;
    }

    showNoteEditor(): void {
        this.application.toggleDevices();
        this.application.toggleNoteEditor();
    }

    showDevices(): void {
        this.application.toggleNoteEditor();
        this.application.toggleDevices();
    };

    invokeAction(actionName): void {
        let action = this.application.getAction(actionName);
        if (action) {
            action.invoke();
        }
    };

    focusClipLaunch = function (): void {
        /*if (layout !== "MIX") {
            this.application.setPanelLayout("MIX");
        }*/
        this.application.focusPanelAbove();
        this.application.zoomToSelection();
    };

}