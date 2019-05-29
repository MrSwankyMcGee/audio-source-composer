
/**
 * Editor requires a modern browser
 * One groups displays at a time. Columns imply simultaneous instructions.
 */

class AudioSourceEditorElement extends HTMLElement {
    constructor() {
        super();
        // this.player = null;
        this.status = {
            // selectedIndexCursor: 0,
            currentGroup: 'root',
            groupHistory: [],
            // cursorCellIndex: 0,
            // cursorPosition: 0,
            selectedIndicies: [0],
            selectedRange: [0,0],

            currentOctave: 3,
            currentInstrumentID: 0,
            currentRenderDuration: null,

            // history: {
            //     currentStep: 0,
            //     undoList: [],
            //     undoPosition: []
            // },
            // webSocket: {
            //     attempts: 0,
            //     reconnectTimeout: 3000,
            //     maxAttempts: 3,
            // },
            previewInstructionsOnSelect: false,
            longPressTimeout: 500,
            autoSaveTimeout: 4000,
        };
        this.saveSongToMemoryTimer = null;
        this.instrumentLibrary = null;

        this.longPressTimeout = null;

        this.values = new AudioSourceEditorValues(this);
        this.webSocket = new AudioSourceEditorWebsocket(this);
        this.keyboard = new AudioSourceEditorKeyboard(this);
        this.menu = new AudioSourceEditorMenu(this);
        this.forms = new AudioSourceEditorForms(this);
        this.grid = new AudioSourceEditorGrid(this);
        // this.modifier = new SongModifier(this);

        this.instruments = new AudioSourceEditorInstruments(this);
        this.instruments.loadInstrumentLibrary(this.getScriptDirectory('instrument/instrument.library.json'));

        this.renderer = new AudioSourceRenderer(this);
    }

    get currentGroup()      { return this.status.currentGroup; }
    get selectedIndicies()  { return this.status.selectedIndicies; }
    get selectedRange()     { return this.status.selectedRange; }
    // get selectedPauseIndicies()  {
    //     const instructionList = this.renderer.getInstructions(this.currentGroup);
    //     return this.selectedIndicies.filter(index => instructionList[index] && instructionList[index].command === '!pause')
    // }
    // get selectedIndicies()  {
    //     const instructionList = this.renderer.getInstructions(this.currentGroup);
    //     return this.selectedIndicies.filter(index => instructionList[index] && instructionList[index].command !== '!pause')
    // }

    getAudioContext()   { return this.renderer.getAudioContext(); }
    getSongData()       { return this.renderer.getSongData(); }


    connectedCallback() {
        this.loadCSS();

        this.addEventListener('submit', this.onInput);
        this.addEventListener('change', this.onInput);
        this.addEventListener('blur', this.onInput);
        this.addEventListener('keydown', this.onInput);
        // this.addEventListener('keyup', this.onInput.bind(this));
        // this.addEventListener('click', this.onInput.bind(this));
        this.addEventListener('contextmenu', this.onInput);
        this.addEventListener('mousedown', this.onInput);
        this.addEventListener('mouseup', this.onInput);
        this.addEventListener('longpress', this.onInput);

        this.addEventListener('song:start', this.onSongEvent);
        this.addEventListener('song:end', this.onSongEvent);
        this.addEventListener('song:pause', this.onSongEvent);
        this.addEventListener('song:modified', this.onSongEvent);
        this.addEventListener('note:start', this.onSongEvent);
        this.addEventListener('note:end', this.onSongEvent);
        this.addEventListener('instrument:loaded', this.onSongEvent);
        this.addEventListener('instrument:instance', this.onSongEvent);
        this.addEventListener('instrument:library', this.onSongEvent);

        this.render();
        this.focus();

        // const uuid = this.getAttribute('uuid');
        // if(uuid)
        //     this.renderer.loadSongFromServer(uuid);

        const src = this.getAttribute('src');
        if(src)
            this.loadSongFromSrc(src);
        else
            this.loadRecentSongData();

        // this.setAttribute('tabindex', 0);
        // this.initWebSocket(uuid);

        // TODO: wait for user input
        navigator.requestMIDIAccess().then(
            (MIDI) => {
                console.log("MIDI initialized", MIDI);
                const inputDevices = [];
                MIDI.inputs.forEach(
                    (inputDevice) => {
                        inputDevices.push(inputDevice);
                        inputDevice.addEventListener('midimessage', e => this.onInput(e));
                    }
                );
                console.log("MIDI input devices detected: " + inputDevices.map(d => d.name).join(', '));
            },
            (err) => { this.onError("error initializing MIDI: " + err); }
        );

    }



    loadNewSongData() {
        const storage = new AudioSourceStorage();
        let songData = storage.generateDefaultSong();
        this.renderer.loadSongData(songData);
    }


    async loadRecentSongData() {
        const storage = new AudioSourceStorage();
        let songRecentGUIDs = storage.getRecentSongList();
        if(songRecentGUIDs[0] && songRecentGUIDs[0].guid) {
            await this.loadSongFromMemory(songRecentGUIDs[0].guid);
        }
    }

    async saveSongToMemory() {
        const songData = this.renderer.getSongData();
        const songHistory = this.renderer.getSongHistory();
        const storage = new AudioSourceStorage();
        await storage.saveSongToMemory(songData, songHistory);
    }

    saveSongToFile() {
        const songData = this.renderer.getSongData();
        // const songHistory = this.renderer.getSongHistory();
        const storage = new AudioSourceStorage();
        storage.saveSongToFile(songData);
    }


    loadSongFromMemory(songGUID) {
        const storage = new AudioSourceStorage();
        const songData = storage.loadSongFromMemory(songGUID);
        const songHistory = storage.loadSongHistoryFromMemory(songGUID);
        this.renderer.loadSongData(songData, songHistory);
        this.render();
        console.info("Song loaded from memory: " + songGUID, songData);
    }

    async loadSongFromFileInput(inputFile) {
        this.loadSongFromMIDIFileInput(inputFile);
    }

    async loadSongFromMIDIFileInput(inputFile) {
        const storage = new AudioSourceStorage();
        const midiData = await storage.loadMIDIFile(inputFile);
        this.renderer.loadSongFromMIDIData(midiData);
        this.render();
        console.info("Song loaded from midi: " + inputFile, midiData, this.renderer.songData);
    }

    async loadSongFromSrc(src) {
        const songData = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', src + '', true);
            xhr.responseType = 'json';
            xhr.onload = () => {
                if(xhr.status !== 200)
                    return reject("Song file not found: " + url);
                resolve(xhr.response);
            };
            xhr.send();
        });
        this.renderer.loadSongData(songData);
        console.info("Song loaded from src: " + src, this.renderer.songData);
        this.render();
    }
    // Input

    // profileInput(e) {
    //     e = e || {};
    //     return {
    //         gridClearSelected: !e.ctrlKey && !e.shiftKey,
    //         gridToggleAction: e.key === ' ' || (!e.shiftKey && !e.ctrlKey) ? 'toggle' : (e.ctrlKey && e.type !== 'mousedown' ? null : 'add'),
    //         gridCompleteSelection: e.shiftKey
    //     };
    // }

    onInput(e) {
        if(e.defaultPrevented)
            return;
        this.renderer.getAudioContext();
        // if(this !== document.activeElement && !this.contains(document.activeElement)) {
        //     console.log("Focus", document.activeElement);
        //     this.focus();
        // }
        switch(e.type) {
            case 'mousedown':
                // Longpress
                if(!e.altKey) { // TODO: fix scroll
                    clearTimeout(this.longPressTimeout);
                    this.longPressTimeout = setTimeout(function () {
                        e.target.dispatchEvent(new CustomEvent('longpress', {
                            detail: {originalEvent: e},
                            cancelable: true,
                            bubbles: true
                        }));
                    }, this.status.longPressTimeout);
                }
                break;

            case 'mouseup':
                // e.preventDefault();
                clearTimeout(this.longPressTimeout);
                break;
        }

        // console.info(e.type, e);

        this.menu.onInput(e);
        this.grid.onInput(e);
        this.forms.onInput(e);
        this.instruments.onInput(e);

        // if(!e.defaultPrevented) {
        //     switch (e.type) {
        //         case 'submit':
        //             // case 'change':
        //             // case 'blur':
        //             console.info("Unhandled " + e.type, e);
        //     }
        // }
    }

    onSongEvent(e) {
        // console.log("Note Event: ", e.type);
        this.grid.onSongEvent(e);
        switch(e.type) {
            case 'song:start':
                this.classList.add('playing');
                break;
            case 'song:end':
            case 'song:pause':
                this.classList.remove('playing');
                break;
            case 'song:modified':
                // this.grid.render();
                // this.forms.render();

                clearTimeout(this.saveSongToMemoryTimer);
                this.saveSongToMemoryTimer = setTimeout(e => this.saveSongToMemory(e), this.status.autoSaveTimeout);
                break;
            case 'instrument:loaded':
                console.info("TODO: load instrument instances", e.detail);
                break;
            case 'instrument:library':
            case 'instrument:instance':
                this.instruments.render();
                this.forms.render();
                break;
        }
    }


    onError(err) {
        console.error(err);
        if(this.webSocket)
            this.webSocket
                .onError(err);
                // .send(JSON.stringify({
                //     type: 'error',
                //     message: err.message || err,
                //     stack: err.stack
                // }));
    }


    // Rendering

    render() {
        // this.innerHTML = ``;
        this.menu.render();
        this.forms.render();
        this.instruments.render();
        this.grid.render();

    }


    // Update DOM

    update() {
        this.menu.update();
        this.forms.update();
        this.grid.update();
        this.instruments.update();
    }

    selectGroup(groupName) {
        this.status.groupHistory = this.status.groupHistory.filter(historyGroup => historyGroup === this.status.currentGroup);
        this.status.groupHistory.unshift(this.status.currentGroup);
        this.status.currentGroup = groupName;
        console.log("Group Change: ", groupName, this.status.groupHistory);
        this.grid = new AudioSourceEditorGrid(this, groupName);
        this.render();
    }

    selectInstructions(indicies=null) {
        this.status.selectedIndicies = [];
        if(typeof indicies === "number") {
            this.status.selectedIndicies = [indicies];
        } else             if(Array.isArray(indicies)) {
            this.status.selectedIndicies = indicies;
        } else if (typeof indicies === "function") {
            let selectedIndicies = [];
            this.renderer.eachInstruction(this.status.currentGroup, (index, instruction, stats) => {
                if (indicies(index, instruction, stats))
                    selectedIndicies.push(index);
            });

            this.selectedIndicies(selectedIndicies);
            return;
        } else {
            throw console.error("Invalid indicies", indicies);
        }
        this.update();
        // this.grid.focus();
        // console.log("selectInstructions", this.status.selectedIndicies);
    }

    playSelectedInstructions() {
        this.renderer.stopAllPlayback();
        const selectedIndicies = this.status.selectedIndicies;
        for(let i=0; i<selectedIndicies.length; i++) {
            this.renderer.playInstructionAtIndex(this.status.currentGroup, selectedIndicies[i]);
        }
    }
    // selectInstructions2(groupName, selectedRange=null, selectedIndicies=null) {
    //     if(selectedIndicies === null)
    //         selectedIndicies = [0]
    //     if (!Array.isArray(selectedIndicies))
    //         selectedIndicies = [selectedIndicies];
    //     this.status.selectedIndicies = selectedIndicies;
    //     if(this.status.currentGroup !== groupName) {
    //         this.status.groupHistory = this.status.groupHistory.filter(historyGroup => historyGroup === this.status.currentGroup);
    //         this.status.groupHistory.unshift(this.status.currentGroup);
    //         this.status.currentGroup = groupName;
    //         console.log("Group Change: ", groupName, this.status.groupHistory);
    //         this.grid = new SongEditorGrid(this, groupName);
    //         this.render();
    //     }
    //     if(selectedRange !== null) {
    //         if(selectedRange && !Array.isArray(selectedRange))
    //             selectedRange = [selectedRange,selectedRange];
    //         this.status.selectedRange = selectedRange;
    //     } else {
    //         this.status.selectedRange = this.renderer.getInstructionRange(groupName, selectedIndicies);
    //     }
    //
    //     this.update();
    //     this.grid.focus();
    // }

    getScriptDirectory(appendPath='') {
        const scriptElm = document.head.querySelector('script[src$="audio-source-editor-element.js"],script[src$="audio-source-editor.min.js"]');
        const basePath = scriptElm.getAttribute('src').split('/').slice(0, -2).join('/') + '/';
        return basePath + appendPath;
    }

    loadCSS() {
        if(document.head.querySelector('link[href$="audio-source-editor.css"]'))
            return;
        const linkHRef = this.getScriptDirectory('editor/audio-source-editor.css');
        let cssLink=document.createElement("link");
        cssLink.setAttribute("rel", "stylesheet");
        cssLink.setAttribute("type", "text/css");
        cssLink.setAttribute("href", linkHRef);
        document.head.appendChild(cssLink);
    }
}
customElements.define('audio-source-editor', AudioSourceEditorElement);