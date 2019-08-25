
/**
 * Editor requires a modern browser
 * One groups displays at a time. Columns imply simultaneous instructions.
 */

class AudioSources {
    constructor(editor) {
        this.editor = editor;
        this.instrumentLibrary = {
            "name": "Loading Instrument Library...",
            "instruments": [
                {
                    "name": "Loading instrument list...",
                    "url": ""
                }
            ]
        };
    }

    get DEFAULT_INSTRUMENT_LIBRARY_URL() {
        const Libraries = new AudioSourceLibraries;
        return Libraries.getScriptDirectory('instrument/instrument.library.json');
    }
    // this.loadInstrumentLibrary(this.DEFAULT_INSTRUMENT_LIBRARY_URL); // TODO: instruments don't load instrument libraries


    getScriptDirectory(appendPath='') {
        const Libraries = new AudioSourceLibraries;
        return Libraries.getScriptDirectory(appendPath);
    }

    getInstrumentLibrary() {
        return this.instrumentLibrary;
    }

    async loadDefaultInstrumentLibrary() {
        return await this.loadInstrumentLibrary(this.DEFAULT_INSTRUMENT_LIBRARY_URL);
    }

    async loadPackageInfo() {
        const Libraries = new AudioSourceLibraries;
        const url = Libraries.getScriptDirectory('package.json');
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url + '', true);
            xhr.responseType = 'json';
            xhr.onload = () => {
                if (xhr.status !== 200)
                    return reject("Sample library not found: " + url);

                const packageJSON = xhr.response;
                console.log("Package Version: ", packageJSON.version, packageJSON);
                resolve(packageJSON);
            };
            xhr.send();
        });
    }

    // Instruments load their own libraries. Libraries may be shared via dispatch
    async loadInstrumentLibrary(url, force = false) {
        if (!url)
            throw new Error("Invalid url");
        url = new URL(url, document.location) + '';
        if (!force && this.instrumentLibrary && this.instrumentLibrary.url === url)
            return this.instrumentLibrary;

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url + '', true);
            xhr.responseType = 'json';
            xhr.onload = () => {
                if (xhr.status !== 200)
                    return reject("Sample library not found: " + url);

                this.instrumentLibrary = xhr.response;
                this.instrumentLibrary.url = url + '';
                this.editor.dispatchEvent(new CustomEvent('instrument:library', {
                    // detail: this.instrumentLibrary,
                    // bubbles: true
                }));
                console.info("Instrument Library Loaded: ", this.instrumentLibrary);
                resolve(this.instrumentLibrary);
            };
            xhr.send();
        });
    }



}
