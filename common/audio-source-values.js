


class AudioSourceValues {
    constructor(renderer=null) {
        this.renderer = renderer;
    }

    // get noteFrequencies() {
    //     return this.renderer.noteFrequencies; // ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    // }

    get noteFrequencies() {
        return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    }

    get valueTypes() {
        return [
            'beats-per-measure',
            'beats-per-minute',
            'command-group-execute',
            'command-instrument-frequencies',
            'durations',
            'groups',
            'instruments-available',
            'named-durations',
            'note-frequencies',
            'note-frequencies-all',
            'note-frequency-octaves',
            'song-groups',
            'song-instruments',
            'song-recent-list',
            'velocities',
        ]
    }

    /** Form Options **/

    getValues(valueType, callback) {
        let noteFrequencies;
        let valuesHTML = '';
        const songData = this.renderer ? this.renderer.getSongData() : null;
        const timeDivision = this.renderer ? this.renderer.getSongTimeDivision() : 96*4;

        switch(valueType) {
            // case 'server-recent-uuid':
            // case 'memory-recent-uuid':
            //     const songRecentUUIDs = JSON.parse(localStorage.getItem(valueType) || '[]');
            //     for(let i=0; i<songRecentUUIDs.length; i++)
            //         valuesHTML += callback.apply(this, songRecentUUIDs[i]);
            //     break;

            case 'song-recent-list':
                // TODO: refactor
                // const Storage = new AudioSourceStorage();
                // const songRecentUUIDs = Storage.getRecentSongList() ;
                // for(let i=0; i<songRecentUUIDs.length; i++)
                //     valuesHTML += callback(songRecentUUIDs[i].guid, songRecentUUIDs[i].title);
                break;

            case 'song-instruments':
                if(this.renderer && songData.instruments) {
                    const instrumentList = songData.instruments;
                    for (let instrumentID = 0; instrumentID < instrumentList.length; instrumentID++) {
                        const instrumentInfo = instrumentList[instrumentID] || {name: "No Instrument Loaded"};
                        // const instrument = this.renderer.getInstrument(instrumentID);
                        valuesHTML += callback(instrumentID, this.format(instrumentID, 'instrument')
                            + ': ' + (instrumentInfo.name ? instrumentInfo.name : instrumentInfo.url.split('/').pop()));
                    }
                }
                break;

            case 'instruments-available':
                // TODO: refactor
                // const sources = new AudioSources(this.renderer);
                // const instrumentLibrary = sources.getInstrumentLibrary();
                // if(instrumentLibrary) {
                //     if(instrumentLibrary.instruments) {
                //         instrumentLibrary.instruments.forEach((pathConfig) => {
                //             let instrumentURL = pathConfig.url;
                //             if(instrumentURL) instrumentURL = new URL(instrumentURL, instrumentLibrary.url) + '';
                //             if (typeof pathConfig !== 'object') pathConfig = {url: pathConfig};
                //             if(!pathConfig.title) pathConfig.title = pathConfig.url.split('/').pop();
                //             valuesHTML += callback(instrumentURL, pathConfig.title); //  + " (" + pathConfig.url + ")"
                //         });
                //     }
                // }
                break;

            case 'command-instrument-frequencies':
                if(songData) {
                    for(let instrumentID=0; instrumentID<songData.instruments.length; instrumentID++) {
                        if(this.renderer.isInstrumentLoaded(instrumentID)) {
                            const instance = this.renderer.getInstrument(instrumentID);
                            if(instance.getFrequencyAliases) {
                                const aliases = instance.getFrequencyAliases();
                                Object.values(aliases).forEach((aliasValue) =>
                                    valuesHTML += callback(aliasValue, aliasValue, `data-instrument="${instrumentID}"`));
                            }
                        }
                    }
                }
                break;

            case 'note-frequencies':
                noteFrequencies = this.noteFrequencies;
                // for(let i=1; i<=6; i++) {
                for(let j=0; j<noteFrequencies.length; j++) {
                    const noteFrequency = noteFrequencies[j]; //  + i
                    valuesHTML += callback(noteFrequency, noteFrequency);
                }
                // }
                break;


            case 'note-frequencies-all':
                noteFrequencies = this.noteFrequencies;
                for(let i=1; i<=6; i++) {
                    for(let j=0; j<noteFrequencies.length; j++) {
                        const noteFrequency = noteFrequencies[j] + i;
                        valuesHTML += callback(noteFrequency, noteFrequency);
                    }
                }
                break;

            case 'note-frequency-octaves':
                for(let oi=1; oi<=7; oi+=1) {
                    valuesHTML += callback(oi, '' + oi);
                }
                break;

            case 'velocities':
                // optionsHTML += callback(null, 'Velocity (Default)');
                for(let vi=100; vi>=0; vi-=10) {
                    valuesHTML += callback(vi, vi);
                }
                break;

            case 'durations':
                for(let i=64; i>1; i/=2) {
                    let fraction = `1/${i}`; //.replace('1/2', '½').replace('1/4', '¼');
                    valuesHTML += callback((1/i)/1.5    * timeDivision, `${fraction}t`);
                    valuesHTML += callback(1/i          * timeDivision, `${fraction}`);
                    valuesHTML += callback(1/i*1.5      * timeDivision, `${fraction}d`);
                }
                for(let i=1; i<=16; i++)
                    valuesHTML += callback(i            * timeDivision, i+'B');
                break;

            case 'named-durations':
                for(let i=64; i>1; i/=2) {
                    let fraction = `1/${i}`; // .replace('1/2', '½').replace('1/4', '¼');
                    valuesHTML += callback(`${fraction}t`,  `${fraction}t`);
                    valuesHTML += callback(`${fraction}`,   `${fraction}`);
                    valuesHTML += callback(`${fraction}d`,  `${fraction}d`);
                }
                for(let i=1; i<=16; i++)
                    valuesHTML += callback(i+'B',i+'B');
                break;

            case 'beats-per-measure':
                for(let vi=1; vi<=12; vi++) {
                    valuesHTML += callback(vi, vi + ` beat${vi>1?'s':''} per measure`);
                }
                break;

            case 'beats-per-minute':
                for(let vi=40; vi<=300; vi+=10) {
                    valuesHTML += callback(vi, vi+ ` beat${vi>1?'s':''} per minute`);
                }
                break;

            case 'song-groups':
            case 'groups':
                if(songData && songData.instructions)
                    Object.keys(songData.instructions).forEach(function(key, i) {
                        valuesHTML += callback(key, key);
                    });
                break;

            case 'command-group-execute':
                if(songData && songData.instructions)
                    Object.keys(songData.instructions).forEach(function(key, i) {
                        valuesHTML += callback('@' + key, '@' + key);
                    });
                break;
            default:
                throw new Error("Invalid Value type: " + valueType);
        }
        return valuesHTML;
    }

    renderEditorFormOptions(optionType, selectCallback) {
        let optionsHTML = '';
        this.getValues(optionType, function (value, label, html='') {
            const selected = selectCallback ? selectCallback(value) : false;
            optionsHTML += `<option value="${value}" ${selected ? ` selected="selected"` : ''}${html}>${label}</option>`;
        });
        return optionsHTML;
    }

    /** Formatting **/

    format(input, type) {
        switch(type) {
            case 'duration':
                let stringValue;
                this.getValues('durations', (duration, durationString) => {
                    if(input === duration || input === durationString)
                        stringValue = durationString;
                });
                if(stringValue)
                    return stringValue;
                input = parseFloat(input).toFixed(2);
                return input.replace('.00', 't');

            case 'instrument':
                if(typeof input !== 'number')
                    return 'N/A'; // throw new Error("Invalid Instrument");
                return input < 10 ? "0" + input : "" + input;

            case 'velocity':
                if(typeof input !== 'number')
                    return 'N/A'; // throw new Error("Invalid Instrument");
                return input === 100 ? "Max" : input+'';

            case 'command':
                return input;

            default:
                throw new Error("Unknown format: " + type);
        }
    }

}

if(typeof module !== "undefined")
    module.exports = {AudioSourceValues};
