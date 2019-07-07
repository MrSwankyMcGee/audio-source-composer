class AudioSourceComposerTracker extends HTMLElement {
    constructor() {
        super();


        // this.cursorCellIndex = 0;
        this.renderTimeout = null;
        this.minimumGridLengthTicks = null;
        this.visibleGridHeight = null;

        // this.instructionElms = null;
    }

    get fieldRenderTimeDivision() { return this.querySelector('form.form-render-time-division select[name=timeDivision]'); }
    get fieldRenderInstrument() { return this.querySelector('form.form-render-instrument select[name=instrument]'); }
    get fieldRenderOctave() { return this.querySelector('form.form-render-octave select[name=octave]'); }

    // get fieldInstructionCommand() { return this.querySelector('form.form-instruction-insert select[name=command]'); }

    get fieldInstructionInstrument() { return this.querySelector('form.form-instruction-instrument select[name=instrument]'); }
    get fieldInstructionDuration() { return this.querySelector('form.form-instruction-duration select[name=duration]'); }
    get fieldInstructionCommand() { return this.querySelector('form.form-note-command select[name=command]'); }
    get fieldInstructionVelocity() { return this.querySelector('form.form-instruction-velocity input[name=velocity]'); }
    get fieldInstructionInsert() { return this.querySelector('form.form-instruction-insert button[name=insert]'); }
    get fieldInstructionDelete() { return this.querySelector('form.form-instruction-delete button[name=delete]'); }

    // get fieldRowDuration() { return this.querySelector('form.form-row-duration select[name=duration]'); }

    // get fieldAddInstrumentInstrument() { return this.querySelector('form.form-add-instrument select[name=instrument]'); }
    get fieldSelectedIndicies() { return this.querySelector('form.form-selected-indicies input[name=indicies]'); }
    // get fieldSelectedRangeStart() { return this.querySelector('form.form-selected-range input[name=rangeStart]'); }
    // get fieldSelectedRangeEnd() { return this.querySelector('form.form-selected-range input[name=rangeEnd]'); }


    get scrollContainer() {
        return this.querySelector('.tracker-scroll-container');
    }

    get groupName()             { return this.getAttribute('group'); }
    set groupName(groupName)    {
        this.setAttribute('group', groupName);
        this.render();
    }
    get timeDivision()             { return parseInt(this.getAttribute('timeDivision')); }
    set timeDivision(timeDivision)    {
        this.setAttribute('timeDivision', timeDivision);
        this.render();
    }

    // get timeDivision() { return this.status.timeDivision; }
    get status() { return this.editor.status.grid; }
    get editorForms() { return this.editor.forms; }


    get selectedCells() { return this.querySelectorAll('asct-instruction.selected'); }
    get cursorCell() { return this.querySelector('asct-instruction.cursor,asct-instruction-add.cursor'); }
    get cursorRow() { return this.cursorCell.parentNode; }
    get cursorPosition() { return this.cursorCell.parentNode.position; }
    get cursorInstruction() { return this.getInstruction(this.cursorCell.index); }
    // }
    get selectedIndicies() { return [].map.call(this.selectedCells, (elm => elm.index)); }


    connectedCallback() {
        this.addEventListener('scroll', this.onInput, true);
        this.editor = this.getRootNode().host;
        if(!this.getAttribute('timeDivision'))
            this.setAttribute('timeDivision', this.editor.renderer.getSongTimeDivision());
        setTimeout(e => this.render(), 20);
    }


    // get cursorCellIndex() {
    playSelectedInstructions() {
        this.editor.renderer.stopAllPlayback();
        const selectedIndicies = this.selectedIndicies;
        for(let i=0; i<selectedIndicies.length; i++) {
            this.editor.renderer.playInstructionAtIndex(this.groupName, selectedIndicies[i]);
        }
    }
    getInstructions(indicies=null) {
        return this.editor.renderer.getInstructions(this.groupName, indicies);
    }

    getInstructionRange(start, end=null) {
        return this.editor.renderer.getInstructionRange(this.groupName, start, end);
    }

    getInstruction(index) {
        return this.editor.renderer.getInstruction(this.groupName, index);
    }

    getInstructionFormValues(isNewInstruction, command=null) {
        if(!command)
            command = this.fieldInstructionCommand.value;
        if(isNewInstruction && !command) {
            // this.fieldInstructionCommand.focus();
            return false;
        }
        let newInstruction = new SongInstruction();

        if(this.fieldInstructionInstrument.value || this.fieldInstructionInstrument.value === 0)
            newInstruction.instrument = parseInt(this.fieldInstructionInstrument.value);
        if(this.fieldInstructionDuration.value) // TODO: refactor DURATIONS
            newInstruction.duration = parseFloat(this.fieldInstructionDuration.value);
        const velocityValue = parseInt(this.fieldInstructionVelocity.value);
        if(velocityValue && velocityValue !== 100)
            newInstruction.velocity = velocityValue;

        command = this.replaceFrequencyAlias(command, newInstruction.instrument);
        newInstruction.command = command;

        return newInstruction;
    }


    render() {
        console.time('grid.render()');
        this.innerHTML = `
            <div class="form-section-container">
            ${this.getFormHTML()}
            </div>
            <div class="tracker-scroll-container">
            </div>
        `;

        this.renderAllRows(0);
        this.update();
        console.timeEnd('grid.render()');
    }


    renderAllRows(timeout=0) {

        const render = () => {
            console.time('grid.renderAllRows');
            const rows = this.scrollContainer.querySelectorAll('asct-row');
            let rowCount = 0;


            const currentScrollPosition = this.scrollContainer ? this.scrollContainer.scrollTop : 0; // Save scroll position

            const getNextRow = () => {
                let rowElm = rows[rowCount];
                if (!rowElm) {
                    rowElm = document.createElement('asct-row');
                    this.scrollContainer.appendChild(rowElm);
                }
                rowCount++;
                return rowElm;
            };

            const renderDuration = this.timeDivision;
            let nextBreakPositionInTicks = 0;
            const renderRows = (index, deltaDuration, groupEndPositionInTicks, rowInstructionList) => {
                let groupStartPositionInTicks = groupEndPositionInTicks - deltaDuration;
                let renderRow = getNextRow();
                renderRow.render(index, groupStartPositionInTicks, rowInstructionList);

                // Quantize the tracker rows
                // TODO: toggled quantization
                while(nextBreakPositionInTicks < groupEndPositionInTicks) {
                    if(nextBreakPositionInTicks !== groupStartPositionInTicks) {
                        renderRow = getNextRow();
                        renderRow.render(index, nextBreakPositionInTicks);
                    }
                    nextBreakPositionInTicks += renderDuration;
                    renderRow.classList.add('break');
                }


            };


            let rowInstructionList = [], lastIndex=0;
            this.editor.renderer.eachInstruction(this.groupName, (index, instruction, stats) => {
                if (instruction.deltaDuration !== 0) {
                    renderRows(lastIndex, instruction.deltaDuration, stats.groupPositionInTicks, rowInstructionList);
                    lastIndex = index;
                    rowInstructionList = [];
                }

                rowInstructionList.push(instruction);
            });


            this.scrollContainer.scrollTop = currentScrollPosition;             // Restore scroll position
            console.timeEnd('grid.renderAllRows');
        };

        if(timeout > 0) {
            clearTimeout(this.renderTimeout);
            this.renderTimeout = setTimeout(e => {
                render();
            }, timeout);
        } else {
            render();
        }

    }

    onInput(e) {
        if (e.defaultPrevented)
            return;
        if(e.target instanceof Node && !this.contains(e.target))
            return;

        // this.focus(); // Prevents tab from working
//         console.log(e.type);

        let selectedIndicies = this.selectedIndicies;
        // const instructionList = this.getInstructions();

        switch (e.type) {
            case 'midimessage':
//                     console.log("MIDI", e.data, e);
                switch(e.data[0]) {
                    case 144:   // Note On
                        e.preventDefault();
                        let newMIDICommand = this.editor.renderer.getCommandFromMIDINote(e.data[1]);
                        let newMIDIVelocity = Math.round((e.data[2] / 128) * 100);
                        console.log("MIDI ", newMIDICommand, newMIDIVelocity);

                        if (this.cursorCell.matches('.new')) {
                            let newInstruction = this.getInstructionFormValues(true);
                            newMIDICommand = this.replaceFrequencyAlias(newMIDICommand, newInstruction.instrument);
                            newInstruction.command = newMIDICommand;
                            newInstruction.velocity = newMIDIVelocity;

                            const insertPosition = this.cursorPosition;
                            const insertIndex = this.insertInstructionAtPosition(insertPosition, newInstruction);
                            // this.cursorRow.render();
                            this.renderAllRows();
                            this.selectIndicies(e, insertIndex);
                            selectedIndicies = [insertIndex];
                            // cursorInstruction = instructionList[insertIndex];
                        } else {
                            for(let i=0; i<selectedIndicies.length; i++) {
                                const selectedInstruction = this.getInstruction(selectedIndicies[i]);
                                const replaceCommand = this.replaceFrequencyAlias(newMIDICommand, selectedInstruction.instrument);
                                this.replaceInstructionCommand(selectedIndicies[i], replaceCommand);
                                this.replaceInstructionVelocity(selectedIndicies[i], newMIDIVelocity);
                            }
                            // this.selectIndicies(this.selectedIndicies[0]); // TODO: select all
                        }
                        // this.renderCursorRow();
                        this.playSelectedInstructions(e);

                        // song.gridSelectInstructions([selectedInstruction]);
                        // e.preventDefault();
                        break;
                    case 128:   // Note Off
                        // TODO: turn off playing note, optionally set duration of note
                        break;
                }
                break;
            case 'keydown':

                let keyEvent = e.key;
                if (!e.ctrlKey && this.editor.keyboard.getKeyboardCommand(e.key))
                    keyEvent = 'PlayFrequency';
                if (keyEvent === 'Enter' && e.altKey)
                    keyEvent = 'ContextMenu';

                // let keydownCellElm = this.cursorCell;

                switch (keyEvent) {
                    case 'Delete':
                        e.preventDefault();
                        for(let i=0; i<selectedIndicies.length; i++) {
                            this.editor.renderer.deleteInstructionAtIndex(this.groupName, selectedIndicies[i]);
                        }
                        this.renderAllRows();
                        // song.render(true);
                        break;

                    case 'Escape':
                    case 'Backspace':
                        e.preventDefault();
                        this.navigatePop();
                        this.selectIndicies(e, 0);
                        // this.focus();
                        break;

                    case 'Enter':
                        e.preventDefault();
                        if (this.cursorCell.matches('.new')) {
                            let newInstruction = this.getInstructionFormValues(true);
                            if(!newInstruction)
                                return console.info("Insert canceled");
                            let insertIndex = this.insertInstructionAtPosition(this.cursorPosition, newInstruction);
                            // this.cursorRow.render();
                            this.renderAllRows();
                            this.selectIndicies(e, insertIndex);
                        }

                        let cursorInstruction = this.cursorInstruction;
                        if(cursorInstruction.isGroupCommand()) {
                            const groupName = cursorInstruction.command.substr(1);
                            this.editor.selectGroup(groupName);
                        } else {
                            this.playSelectedInstructions(e);
                        }
                        break;

                    case 'Play':
                        e.preventDefault();
                        this.playSelectedInstructions(e);
                        // for(let i=0; i<selectedIndicies.length; i++) {
                        //     this.editor.renderer.playInstruction(instructionList[i]);
                        // }
                        break;

                    // ctrlKey && metaKey skips a measure. shiftKey selects a range
                    case 'ArrowRight':
                        e.preventDefault();
                        this.selectNextCell(e);
                        this.playSelectedInstructions(e);
                        break;

                    case 'ArrowLeft':
                        e.preventDefault();
                        this.selectPreviousCell(e);
                        this.playSelectedInstructions(e);
                        break;

                    case 'ArrowDown':
                        e.preventDefault();
                        this.selectNextRowCell(e);
                        this.playSelectedInstructions(e);
                        break;

                    case 'ArrowUp':
                        e.preventDefault();
                        this.selectPreviousRowCell(e);
                        this.playSelectedInstructions(e);
                        break;

                    case ' ':
                        e.preventDefault();
                        // this.selectCell(e, this.cursorCell);
                        // if(e.ctrlKey) e.preventDefault();
                        if(this.editor.renderer.isPlaybackActive()) {
                            this.editor.renderer.stopAllPlayback();
                        } else {
                            this.editor.renderer.playInstructions(this.groupName);
                        }
                        break;

                    case 'PlayFrequency':
                        let newCommand = this.editor.keyboard.getKeyboardCommand(e.key);
                        if(newCommand === null)
                            break;

                        e.preventDefault();

                        if (this.cursorCell.matches('asct-instruction-add')) {
                            console.time("new");
                            let newInstruction = this.getInstructionFormValues(true, newCommand);
                            if(!newInstruction) {
                                this.fieldInstructionCommand.focus();
                                return console.info("Insert canceled");
                            }
                            // newInstruction.command = newCommand;

                            const insertPosition = this.cursorPosition;
                            const insertIndex = this.insertInstructionAtPosition(insertPosition, newInstruction);
                            // this.cursorRow.render(true);
                            this.renderAllRows();
                            this.selectIndicies(e, insertIndex);
                            selectedIndicies = [insertIndex];
                            console.timeEnd("new");
                            // cursorInstruction = instructionList[insertIndex];
                        } else {
                            for(let i=0; i<selectedIndicies.length; i++) {
                                const selectedInstruction = this.getInstruction(selectedIndicies[i]);
                                const replaceCommand = this.replaceFrequencyAlias(newCommand, selectedInstruction.instrument);
                                this.replaceInstructionCommand(selectedIndicies[i], replaceCommand);
                            }
                            // this.selectIndicies(this.selectedIndicies[0]); // TODO: select all
                        }

                        // this.render();
                        // this.renderCursorRow();
                        this.playSelectedInstructions(e);

                        // song.gridSelectInstructions([selectedInstruction]);
                        // e.preventDefault();
                        break;

                }
                break;

            case 'mousedown':
                this.editor.menu.closeMenu();

                if (e.target.matches('asct-instruction'))
                    return this.onCellInput(e);

                if (e.target.matches('asct-instruction > *'))
                    return this.onParamInput(e);

                if (e.target.matches('asct-row'))  // classList.contains('tracker-row')) {
                    return this.onRowInput(e);
                // e.preventDefault();


                // e.target = this.querySelector('.tracker-cell.selected') || this.querySelector('.instruction'); // Choose selected or default cell
                break;

            case 'mouseup':
                break;

            case 'longpress':
                // if (e.target.classList.contains('tracker-parameter')
                //     || e.target.classList.contains('tracker-cell')
                //     || e.target.classList.contains('tracker-data')
                //     || e.target.classList.contains('tracker-row')) {
                e.preventDefault();
                // console.log("Longpress", e);
                if(this.scrollContainer.contains(e.target)) {
                    this.editor.menu.openContextMenu(e);
                }
                // }
                break;

            case 'contextmenu':
                // if (e.target.classList.contains('tracker-parameter')) {
                //     console.info("TODO: add parameter song at top of context menu: ", e.target); // huh?
                // }
                if(this.scrollContainer.contains(e.target)) {
                    if (!e.altKey) {
                        e.preventDefault();
                        this.editor.menu.openContextMenu(e);
                    }
                }
                break;

            case 'scroll':
                this.renderAllRows(50);
                break;

            case 'submit':
                e.preventDefault();
                this.onSubmit(e);
                break;
            case 'change':
            case 'blur':
                if(e.target.form && e.target.form.classList.contains('submit-on-' + e.type))
                    this.onSubmit(e);
                break;

            default:
                throw new Error("Unhandled type: " + e.type);

        }
    }

    getFormHTML() {
        return `

             
            <div class="form-section-divide">
                <form action="#" class="form-note-toggle" data-action="toggle:control-tracker">
                    <button name="toggle" class="themed" title="Show/Hide Tracker Controls">
                        <div>Tracker</div>
                    </button>
                </form>
            </div>
 
            <div class="form-section control-tracker">
                <div class="form-section-header">Instruction</div>
                <form action="#" class="form-note-command submit-on-change" data-action="instruction:command">
                    <select name="command" title="Instruction Command" class="themed" required="required">
                        <option value="">Command (Choose)</option>
                        <optgroup label="Custom Frequencies" class="instrument-frequencies">
                            ${this.editor.values.renderEditorFormOptions('command-instrument-frequencies')}
                        </optgroup>
                        <optgroup label="Frequencies">
                            ${this.editor.values.renderEditorFormOptions('note-frequencies-all')}
                        </optgroup>
                        <optgroup label="Group Execute">
                            ${this.editor.values.renderEditorFormOptions('command-group-execute')}
                        </optgroup>
                    </select>
                </form>
                <form action="#" class="form-instruction-insert" data-action="instruction:insert">
                    <button name="insert" class="themed" title="Insert Instruction">+</button>
                </form>
                <form action="#" class="form-instruction-delete submit-on-change" data-action="instruction:delete">
                    <button name="delete" class="themed" title="Delete Instruction" disabled>X</button>
                </form>
            </div>
            
            <form action="#" class="form-instruction-instrument submit-on-change" data-action="instruction:instrument">
            <div class="form-section-header">Instrument</div>
                <select name="instrument" title="Instruction Instrument" class="themed">
                    <option value="">None</option>
                    <optgroup label="Song Instruments">
                        ${this.editor.values.renderEditorFormOptions('song-instruments')}
                    </optgroup>
                </select>
            </form>
            
            <form action="#" class="form-instruction-velocity submit-on-change" data-action="instruction:velocity">
            <div class="form-section-header">Velocity</div>
                <input type="range" name="velocity" min="1" max="100" class="themed" />
            </form>
            
            
            <form action="#" class="form-instruction-duration submit-on-change" data-action="instruction:duration">
                <div class="form-section-header">Duration</div>
                <select name="duration" title="Instruction Duration" class="themed">
                    <option value="">No Duration</option>
                    <optgroup label="Note Duration">
                        ${this.editor.values.renderEditorFormOptions('durations')}
                    </optgroup>
                </select>
            </form>
             
            
                
            <form action="#" class="form-render-octave submit-on-change" data-action="status:octave">
                <div class="form-section-header">Octave</div>
                <select name="octave" class="themed">
                    <optgroup label="Select Octave">
                        ${this.editor.values.renderEditorFormOptions('note-frequency-octaves')}
                    </optgroup>
                </select>
            </form>
            
            <div class="form-section control-tracker">
                <div class="form-section-header">Render Group</div>
                ${this.editor.values.getValues('groups', (value, label) =>
            `<form action="#" class="form-group" data-action="group:edit">`
            + `<button name="groupName" value="${value}" class="themed" >${label}</button>`
            + `</form>`)}
                
                <form action="#" class="form-group" data-action="group:edit">
                    <button name="groupName" value=":new" class="new themed" title="Create new group">+</button>
                </form>
                
            </div>
            
            <form action="#" class="form-render-time-division submit-on-change" data-action="tracker:duration">
                <div class="form-section-header">Quantize</div>
                <select name="timeDivision" title="Render Duration" class="themed">
                    <option value="">No Duration</option>
                    <optgroup label="Render Duration">
                        ${this.editor.values.renderEditorFormOptions('durations')}
                    </optgroup>
                </select>
            </form>
            
            <form action="#" class="form-render-instrument submit-on-change" data-action="tracker:instrument">
                <div class="form-section-header">Filter By Instrument</div>                    
                <select name="instrument" class="themed"->
                    <option value="">Show All (Default)</option>
                    <optgroup label="Filter By">
                        ${this.editor.values.renderEditorFormOptions('song-instruments')}
                    </optgroup>
                </select>
            </form>
            
            <form class="form-selected-indicies submit-on-change" data-action="tracker:selected">
                <div class="form-section-header">Indicies</div>                    
                <input name="indicies" placeholder="No indicies selection" />
            </form>
        `;
    }

    onSubmit(e, form) {
        if(!form)
            form = e.target.form || e.target;
        if(!form.matches('form'))
            throw new Error("Invalid Form: " + form);
        const command = form.getAttribute('data-action');
        // const cursorCellIndex = this.editor.cursorCellIndex;
        const currentGroup = this.groupName;
        // const selectedIndicies = this.editor.status.selectedIndicies;
        const selectedIndices = this.selectedIndicies;
        // const selectedPauseIndices = this.editor.selectedPauseIndicies;
        // const selectedRange = this.editor.selectedRange;

        switch (command) {

            case 'instruction:insert':
                let newInstruction = this.getInstructionFormValues(true);
                if(!newInstruction) {
                    this.fieldInstructionCommand.focus();
                    return console.info("Insert canceled");
                }
                const insertPosition = this.cursorPosition;
                const insertIndex = this.editor.renderer.insertInstructionAtPosition(currentGroup, insertPosition, newInstruction);
                // this.cursorRow.render(true);
                this.renderAllRows();
                this.selectIndicies(e, insertIndex);
                this.editor.renderer.playInstruction(newInstruction);
                break;

            case 'instruction:command':
                if(form['command'].value === '') {
                    form['command'].focus();
                    return;
                }
                const newCommand = form['command'].value;
                let newInstrument = null;
                if(form.elements['command'].selectedOptions[0] && form.elements['command'].selectedOptions[0].hasAttribute('data-instrument'))
                    newInstrument = parseInt(form.elements['command'].selectedOptions[0].getAttribute('data-instrument'));
                for(let i=0; i<selectedIndices.length; i++) {
                    this.editor.renderer.replaceInstructionCommand(currentGroup, selectedIndices[i], newCommand);
                    if(newInstrument !== null)
                        this.editor.renderer.replaceInstructionInstrument(currentGroup, selectedIndices[i], newInstrument);
                    this.editor.renderer.playInstructionAtIndex(currentGroup, selectedIndices[i]);
                }
                // this.editor.playSelectedInstructions();
                this.fieldInstructionCommand.focus();
                // setTimeout(() => this.fieldInstructionCommand.focus(), 1);
                break;

            case 'instruction:instrument':
                let instrumentID = form.instrument.value === '' ? null : parseInt(form.instrument.value);
                for(let i=0; i<selectedIndices.length; i++)
                    this.editor.renderer.replaceInstructionInstrument(currentGroup, selectedIndices[i], instrumentID);
                this.editor.status.currentInstrumentID = instrumentID;
                this.editor.playSelectedInstructions();
                this.fieldInstructionInstrument.focus();
                break;

            case 'instruction:duration':
                const duration = parseFloat(form.duration.value) || null;
                for(let i=0; i<selectedIndices.length; i++)
                    this.editor.renderer.replaceInstructionDuration(currentGroup, selectedIndices[i], duration);
                this.editor.playSelectedInstructions();
                this.fieldInstructionDuration.focus();
                break;

            case 'instruction:velocity':
                const velocity = form.velocity.value === "0" ? 0 : parseInt(form.velocity.value) || null;
                for(let i=0; i<selectedIndices.length; i++)
                    this.editor.renderer.replaceInstructionVelocity(currentGroup, selectedIndices[i], velocity);
                this.editor.playSelectedInstructions();
                this.fieldInstructionVelocity.focus();
                break;

            case 'instruction:delete':
                for(let i=0; i<selectedIndices.length; i++)
                    this.editor.renderer.deleteInstructionAtIndex(currentGroup, selectedIndices[i]);
                break;

            // case 'row:edit':
            //     this.editor.renderer.replaceInstructionParams(currentGroup, selectedPauseIndices, {
            //         command: '!pause',
            //         duration: parseFloat(form.duration.value)
            //     });
            //     // this.trackerSelect([instruction]);
            //     break;

            // case 'row:duplicate':
            //     if (!selectedRange)
            //         throw new Error("No selected range");
            //     this.editor.renderer.duplicateInstructionRange(currentGroup, selectedRange[0], selectedRange[1]);
            //     break;


            case 'group:edit':
                if (form.groupName.value === ':new') {
                    let newGroupName = this.editor.renderer.generateInstructionGroupName(currentGroup);
                    newGroupName = prompt("Create new instruction group?", newGroupName);
                    if (newGroupName) this.editor.renderer.addInstructionGroup(newGroupName, []);
                    else console.error("Create instruction group canceled");
                    this.editor.render();
                } else {
                    this.editor.selectGroup(form.groupName.value);
                }
                break;

            case 'tracker:octave':
                this.editor.status.currentOctave = parseInt(this.fieldRenderOctave.value);
                break;

            case 'tracker:duration':
                this.timeDivision = this.fieldRenderTimeDivision.value;
                this.render();
                break;

            case 'tracker:instrument':
                this.render();
                break;


            default:
                console.warn("Unhandled " + e.type + ": ", command);
                break;
        }
        // } catch (e) {
        //     this.onError(e);
        // }
    }

    createNewInstructionCell(rowElement) {
        this.querySelectorAll('asct-instruction-add')
            .forEach((elm) => elm.parentNode.removeChild(elm));
        const newInstructionElm = document.createElement('asct-instruction-add');
        newInstructionElm.position = rowElement.position; // setAttribute('p', rowElement.position);
        newInstructionElm.innerHTML = `+`;
        const deltaElm = rowElement.querySelector('asct-delta');
        rowElement.insertBefore(newInstructionElm, deltaElm);
        return newInstructionElm;
    }

    onRowInput(e) {
        e.preventDefault();
        let selectedRow = e.target;
        selectedRow.select();
        this.update();
        this.focus();
        this.playSelectedInstructions(e);
    }

    onCellInput(e) {
        e.preventDefault();
        let selectedCell = e.target;
        selectedCell.select();
        this.update();
        this.focus();
        this.playSelectedInstructions(e);
    }

    onParamInput(e) {
        e.preventDefault();
        let selectedCell = e.target;
        selectedCell.instruction.select();
        this.update();
        this.focus();
        this.playSelectedInstructions(e);
    }

    onSongEvent(e) {
        // console.log("onSongEvent", e);
        const detail = e.detail || {stats:{}};
        let rowElm, instructionElm;
        switch(e.type) {

            case 'note:play':
                rowElm = this.findRowElement(detail.stats.groupPositionInTicks);
                instructionElm = this.findInstructionElement(detail.stats.currentIndex);


                const currentTime = detail.currentTime;
                // if(detail.startTime > currentTime)
                    setTimeout(() => {
                        if(instructionElm) {
                            instructionElm.classList.add('playing');
                        }
                        if(rowElm) {
                            rowElm.classList.add('playing');
                            rowElm.scrollTo(); // Scroll To position, not index
                        }

                    }, (detail.startTime - currentTime) * 1000);
                // else {
                //     // Start immediately
                // }

                if(detail.duration) {
                    setTimeout(() => {
                        if(instructionElm) {
                            instructionElm.classList.remove('playing');
                        }
                        if(rowElm) {
                            rowElm.classList.remove('playing');
                        }
                    }, (detail.startTime - currentTime + detail.duration) * 1000);
                }

                break;
            //
            // case 'note:start':
            //     rowElm = this.findRowElement(detail.stats.groupPositionInTicks);
            //     instructionElm = this.findInstructionElement(detail.stats.currentIndex);
            //     if(instructionElm) {
            //         instructionElm.classList.add('playing');
            //         instructionElm.scrollTo(); // Scroll To position, not index
            //     }
            //     if(rowElm) {
            //         rowElm.classList.add('playing');
            //     }
            //     break;
            // case 'note:end':
            //     rowElm = this.findRowElement(detail.stats.groupPositionInTicks);
            //     instructionElm = this.findInstructionElement(detail.stats.currentIndex);
            //     if(instructionElm) {
            //         instructionElm.classList.remove('playing');
            //     }
            //     if(rowElm) {
            //         rowElm.classList.remove('playing');
            //     }
            //     break;

            // case 'song:start':
            //     this.classList.add('playing');
            //     break;
            // case 'song:end':
            // case 'song:pause':
            //     this.classList.remove('playing');
            //     break;
        }
    }

    selectNextCell(e) {
        const cursorCell = this.cursorCell || this.querySelector('asct-instruction');
        if(cursorCell.nextElementSibling && cursorCell.nextElementSibling.matches('asct-instruction,asct-instruction-add'))
            return this.selectCell(e, cursorCell.nextElementSibling);

        // If no previous row cell, create new instruction cell
        if(cursorCell.nodeName.toLowerCase() === 'asct-instruction-add') {
            const cursorRow = cursorCell.parentNode;
            const nextRowElm = cursorRow.nextElementSibling;
            this.selectCell(e, nextRowElm.firstElementChild);
            return;
        }

        const currentRowElm = this.cursorCell.parentNode;
        this.selectCell(e, this.createNewInstructionCell(currentRowElm));
    }

    selectNextRowCell(e, cellPosition=null, increaseTrackerSize=true) {
        const cursorCell = this.cursorCell || this.querySelector('asct-instruction');
        const cursorRow = cursorCell.parentNode;
        if(cellPosition === null)
            cellPosition = [].indexOf.call(cursorCell.parentNode.children, cursorCell);
        if(!cursorRow.nextElementSibling) {
            if(!increaseTrackerSize)
                throw new Error("New row was not created");
            return this.increaseTrackerSize(e);
            // return this.selectNextRowCell(e, false);
        }

        const nextRowElm = cursorRow.nextElementSibling;
        // for(let i=cellPosition; i>=0; i--)
        //     if(nextRowElm.children[i] && nextRowElm.children[i].matches('asct-instruction,asct-instruction-add'))
        //         return this.selectCell(e, nextRowElm.children[i]);
        if(nextRowElm.children[cellPosition] && nextRowElm.children[cellPosition].matches('asct-instruction,asct-instruction-add'))
            return this.selectCell(e, nextRowElm.children[cellPosition]);

        // let nextCell = nextRowElm.querySelector('asct-instruction');
        // if(nextCell) {
        //     return this.selectCell(e, nextCell);
        // }


        this.selectCell(e, this.createNewInstructionCell(nextRowElm));
    }
    selectPreviousCell(e) {
        const cursorCell = this.cursorCell || this.querySelector('asct-instruction');
        if(cursorCell.previousElementSibling && cursorCell.previousElementSibling.matches('asct-instruction'))
            return this.selectCell(e, cursorCell.previousElementSibling);

        this.selectPreviousRowCell(e, -1);
    }


    selectPreviousRowCell(e, cellPosition=null) {
        const cursorCell = this.cursorCell || this.querySelector('asct-instruction');
        const cursorRow = cursorCell.parentNode;
        cellPosition = cellPosition === null ? [].indexOf.call(cursorRow.children, cursorCell) : cellPosition;

        let previousRowElm = cursorRow.previousElementSibling;
        if(!previousRowElm)
            previousRowElm = cursorRow.parentNode.lastElementChild; // throw new Error("Previous row not available");

        if(previousRowElm.children[cellPosition] && previousRowElm.children[cellPosition].matches('asct-instruction')) {
            return this.selectCell(e, previousRowElm.children[cellPosition]);
        }

        // If parallel column cell is available, select it

        this.selectCell(e, this.createNewInstructionCell(previousRowElm));
    }


    selectCell(e, cursorCell, clearSelection=true, toggle=false) {
//         console.log("Select ", cursorCell);
//         console.time('selectCell');
        cursorCell.select();
        this.update();
        this.focus();
        cursorCell.parentNode.scrollTo();
        // this.scrollToCursor(cursorCell);
        // console.timeEnd('selectCell');
        // console.log(cursorCell);
    }




    selectIndicies(e, indicies) {
        if(!Array.isArray(indicies))
            indicies = [indicies];
        for(let i=0; i<indicies.length; i++) {
            const cell = this.findInstructionElement(indicies[i]);
            if(!cell)
                throw new Error("Instruction not found: " + indicies[i])
            this.selectCell(e, cell, i === 0);
        }
    }





    findInstruction(instruction) {
        let instructionGroup = this.editor.renderer.findInstructionGroup(instruction);
        if(instructionGroup !== this.groupName)
            return null;
        let index = this.editor.renderer.getInstructionIndex(instruction, instructionGroup);
        return this.findInstructionElement(index);
    }

    navigate(groupName, parentInstruction) {
        console.log("Navigate: ", groupName);
        const existingTracker = this.status.trackers.find(obj => obj.groupName === groupName);
        if(existingTracker)
            this.status.trackers.unshift(existingTracker);
        else
            this.status.trackers.unshift(
                Object.assign({}, AudioSourceComposerElement.DEFAULT_TRACKER_STATUS, {
                    groupName: groupName,
                    parentInstruction: parentInstruction,
                })
            );
        this.render();
    }


    navigatePop() {
        console.log("Navigate Back: ", this.status.trackers[0].groupName);
        if(this.status.trackers.length > 0)
            this.status.trackers.shift();
        this.render();
    }


    increaseTrackerSize(e, selectNewRow=true) {
        // TODO: sloppy
        this.editor.renderer.eachInstruction(this.groupName, (index, instruction, stats) => {
            if (this.minimumTrackerLengthTicks < stats.groupPositionInTicks)
                this.minimumTrackerLengthTicks = stats.groupPositionInTicks;
        });

        // const defaultDuration = parseFloat(this.editorForms.fieldRenderTimeDivision.value);
        this.minimumTrackerLengthTicks += this.timeDivision;
        this.render();
        if(selectNewRow) {
            const lastRowElm = this.querySelector('.composer-tracker > div:last-child');
            this.selectCell(e, this.createNewInstructionCell(lastRowElm));
        }
    }

    insertInstructionAtIndex(instruction, insertIndex) {
        return this.editor.renderer.insertInstructionAtIndex(this.groupName, insertIndex, instruction);
    }
    insertInstructionAtPosition(insertTimePosition, instruction) {
        return this.editor.renderer.insertInstructionAtPosition(this.groupName, insertTimePosition, instruction);
    }

    deleteInstructionAtIndex(deleteIndex) {
        return this.editor.renderer.deleteInstructionAtIndex(this.groupName, deleteIndex, 1);
    }
    replaceInstructionCommand(replaceIndex, newCommand) {
        return this.editor.renderer.replaceInstructionCommand(this.groupName, replaceIndex, newCommand);
    }
    replaceInstructionVelocity(replaceIndex, newVelocity) {
        return this.editor.renderer.replaceInstructionVelocity(this.groupName, replaceIndex, newVelocity);
    }

    // replaceInstructionParams(replaceIndex, replaceParams) {
    //     return this.editor.renderer.replaceInstructionParams(this.groupName, replaceIndex, replaceParams);
    // }


    replaceFrequencyAlias(noteFrequency, instrumentID) {
        const instrument = this.editor.renderer.getInstrument(instrumentID, false);
        if(!instrument || !instrument.getFrequencyAliases)
            return noteFrequency;
        const aliases = instrument.getFrequencyAliases(noteFrequency);
        if(typeof aliases[noteFrequency] === "undefined")
            return noteFrequency;
        return aliases[noteFrequency];
    }

    // selectInstructions(selectedIndicies) {
    //     return this.selectIndicies(selectedIndicies);
    // }


    scrollToCursor(cursorCell) {
        const container = this; // cursorCell.closest('.composer-tracker-container');
        if(container.scrollTop < cursorCell.parentNode.offsetTop - container.offsetHeight)
            container.scrollTop = cursorCell.parentNode.offsetTop;

        if(container.scrollTop > cursorCell.parentNode.offsetTop)
            container.scrollTop = cursorCell.parentNode.offsetTop - container.offsetHeight;

        // if(!this.cursorCell)
        //     return;
        // const currentCellParent = this.cursorCell.parentNode;
        // console.log("TODO: ", currentCellParent.offsetTop, this.scrollTop, this.offsetHeight);
        // if(currentCellParent.offsetTop < this.scrollTop)
        //     this.scrollTop = currentCellParent.offsetTop;
        // if(currentCellParent.offsetTop > this.scrollTop + this.offsetHeight)
        //     this.scrollTop = currentCellParent.offsetTop - this.offsetHeight + this.cursorCell.offsetHeight;
    }

    findInstructionElement(instructionIndex) {
        return this.querySelector(`asct-instruction[i='${instructionIndex}']`);
    }

    findRowElement(rowPosition) {
        return this.querySelector(`asct-row[p='${rowPosition}']`);
    }

    getInstructionHTML(index, instruction) {
        return `<div class="instruction" data-index="${index}">
                    <div class="command">${instruction.command}</div>
                    ${instruction.instrument !== null ? `<div class="instrument">${this.editor.values.format(instruction.instrument, 'instrument')}</div>` : ''}
                    ${instruction.velocity !== null ? `<div class="velocity">${this.editor.values.format(instruction.velocity, 'velocity')}</div>` : ''}
                    ${instruction.duration !== null ? `<div class="duration">${this.editor.values.format(instruction.duration, 'duration')}</div>` : ''}
                </div>`;
    }


    getRowHTML(songPositionInTicks, subDurationInTicks, instructionList, startingIndex) {
        const rowHTML = [];
        let currentIndex = startingIndex;
        for(let i=0; i<instructionList.length; i++)
            rowHTML.push(this.getInstructionHTML(currentIndex++, instructionList[i]));

        return `<div data-position="${songPositionInTicks}">
                   ${rowHTML.join('')}
                   <div class="delta">${this.editor.values.format(subDurationInTicks, 'duration')}</div>
                </div>`;
    }

    // renderCursorRow() {
    //     const songPositionInTicks = parseInt(this.cursorRow.getAttribute('data-position'));
    //     const instructionList = [];
    //     let startingIndex = null;
    //     let lastSongPositionInTicks = 0, lastSubDurationInTicks=0;
    //
    //     this.editor.renderer.eachInstruction(this.groupName, (index, instruction, stats) => {
    //         if(lastSongPositionInTicks !== stats.groupPositionInTicks) {
    //             lastSubDurationInTicks = stats.groupPositionInTicks - lastSongPositionInTicks;
    //             lastSongPositionInTicks = stats.groupPositionInTicks;
    //         }
    //         if (stats.groupPositionInTicks === songPositionInTicks) {
    //             if(startingIndex === null)
    //                 startingIndex = index;
    //             instructionList.push(instruction);
    //         } else if (stats.groupPositionInTicks > songPositionInTicks) {
    //             return false;
    //         }
    //     });
    //
    //     this.cursorRow.outerHTML = this.getRowHTML(songPositionInTicks, lastSubDurationInTicks, instructionList, startingIndex);
    //     this.update();
    // }

    update() {

        let selectedIndicies = this.selectedIndicies;
        let timeDivision = this.timeDivision || this.editor.renderer.getSongTimeDivision();
        const selectedInstructionList = this.editor.renderer.getInstructions(this.groupName, selectedIndicies);
        let cursorInstruction = selectedInstructionList[0];

        // Row Instructions

        // Group Buttons
        // this.querySelectorAll('button[name=groupName]')
        //     .forEach(button => button.classList.toggle('selected', button.getAttribute('value') === groupName));

        // TODO: combine instructions? nah


        // this.fieldInstructionDuration.value = parseFloat(this.fieldRenderTimeDivision.value) + '';

        const containerElm = this.editor.container;
        containerElm.classList.remove('show-control-tracker-insert');
        containerElm.classList.remove('show-control-tracker-modify');

        if(selectedIndicies.length > 0) {
            this.fieldInstructionDelete.removeAttribute('disabled');
        } else {
            this.fieldInstructionDelete.setAttribute('disabled', 'disabled');
            // this.fieldInstructionCommand.value = cursorInstruction.command;
        }

        if(cursorInstruction) {
            // Note Instruction
            this.fieldInstructionCommand.value = cursorInstruction.command;
            this.fieldInstructionInstrument.value = cursorInstruction.instrument !== null ? cursorInstruction.instrument : '';
            this.fieldInstructionVelocity.value = cursorInstruction.velocity !== null ? cursorInstruction.velocity : '';
            this.fieldInstructionDuration.value = cursorInstruction.duration !== null ? cursorInstruction.duration : '';
            containerElm.classList.add('show-control-tracker-modify');

        } else if(selectedIndicies.length === 0) {
            // this.fieldInstructionInstrument.value = this.editor.status.currentInstrumentID;
            // console.log(this.editor.status.currentInstrumentID);

            containerElm.classList.add('show-control-tracker-insert');
        }

        this.fieldInstructionCommand.querySelectorAll('.instrument-frequencies option').forEach((option) =>
            option.classList.toggle('hidden', this.fieldInstructionInstrument.value !== option.getAttribute('data-instrument')));
        this.fieldInstructionCommand.querySelectorAll('.instrument-frequencies option').forEach((option) =>
            option.classList.toggle('hidden', this.fieldInstructionInstrument.value !== option.getAttribute('data-instrument')));

        // const oldInsertCommand = this.fieldInstructionCommand.value;
        // this.fieldInstructionCommand.querySelector('.instrument-frequencies').innerHTML = instructionCommandOptGroup.innerHTML;
        // this.fieldInstructionCommand.value = oldInsertCommand;
        // if(!this.fieldInstructionCommand.value)
        //     this.fieldInstructionCommand.value-this.fieldInstructionCommand.options[0].value

        this.querySelectorAll('.multiple-count-text').forEach((elm) => elm.innerHTML = (selectedIndicies.length > 1 ? '(s)' : ''));

        // Status Fields

        this.fieldRenderOctave.value = this.editor.status.currentOctave;

        if(!this.fieldRenderTimeDivision.value && timeDivision)
            this.fieldRenderTimeDivision.value = timeDivision; // this.editor.renderer.getSongTimeDivision();
        if(!this.fieldInstructionDuration.value && this.fieldRenderTimeDivision.value)
            this.fieldInstructionDuration.value = this.fieldRenderTimeDivision.value;


        this.fieldSelectedIndicies.value = selectedIndicies.join(',');
        // this.fieldSelectedRangeStart.value = this.editor.selectedRange[0];
        // this.fieldSelectedRangeEnd.value = this.editor.selectedRange[1];

    }
}
customElements.define('asc-tracker', AudioSourceComposerTracker);





class AudioSourceComposerTrackerRow extends HTMLElement {
    constructor() {
        super();
    }
    get tracker() { return this.closest('asc-tracker'); }
    // get editor() { return this.tracker.editor; }

    set position(songPositionInTicks)   { this.setAttribute('p', songPositionInTicks); }
    get position()                      { return parseInt(this.getAttribute('p'))}

    // set duration(durationInTicks)       { this.setAttribute('d', durationInTicks); }
    // get duration()                      { return parseInt(this.getAttribute('d'))}
    get duration()                      {
        return this.nextElementSibling ? this.nextElementSibling.position - this.position : 'N/A';
    }

    // set index(rowIndex)                 { this.setAttribute('i', rowIndex); }
    // get index()                         { return parseInt(this.getAttribute('i'))}

    get visible() {
        const parentBottom = this.parentNode.scrollTop + this.parentNode.offsetHeight;
        const offsetBottom = this.offsetTop + this.offsetHeight;
        if(this.offsetTop - parentBottom > 0)
            return false;
        if(offsetBottom < this.parentNode.scrollTop)
            return false;
        return true;
    }

    select() {
        this.parentNode.querySelectorAll('asct-row.selected')
            .forEach((elm) => elm.classList.remove('selected'));
        this.classList.add('selected');

        // Unselect all instrument cells
        this.parentNode.querySelectorAll('asct-instruction.selected,asct-instruction-add.selected')
            .forEach((elm) => elm.classList.remove('selected'));
        this.parentNode.querySelectorAll('asct-instruction.cursor,asct-instruction-add.cursor')
            .forEach((elm) => elm.classList.remove('cursor'));

        let existingInstructionAddElement = this.querySelector('asct-instruction-add');
        if(!existingInstructionAddElement) {
            // Remove existing new instruction button
            this.parentNode.querySelectorAll('asct-instruction-add')
                .forEach((elm) => elm.parentNode.removeChild(elm));

            const newInstructionElm = document.createElement('asct-instruction-add');
            existingInstructionAddElement = newInstructionElm;
            newInstructionElm.position = this.position; // setAttribute('p', rowElement.position);
            newInstructionElm.innerHTML = `+`;
            const deltaElm = this.querySelector('asct-delta');
            this.insertBefore(newInstructionElm, deltaElm);
        }
        existingInstructionAddElement.classList.add('cursor');

        // TODO: this.selectIndicies([]);
        // const newInstructionElm = this.createNewInstructionCell(selectedRow);
        // this.selectCell(e, newInstructionElm);
    }

    scrollTo() {
        const container = this.tracker.scrollContainer; // cursorCell.closest('.composer-tracker-container');
        if (container.scrollTop < this.offsetTop - container.offsetHeight)
            container.scrollTop = this.offsetTop;

        if (container.scrollTop > this.offsetTop)
            container.scrollTop = this.offsetTop - container.offsetHeight;
    }

    connectedCallback() {
        // setTimeout(e => this.render(), 1);
    }


    render(index, songPositionInTicks, rowInstructionList=[]) {
        this.position = songPositionInTicks;
        // this.duration = deltaDuration;

        if(this.visible) {
            // if(this.childNodes.length === 0) {
            this.innerHTML = '';
            // const rowInstructionList = this.tracker.getInstructionRange(startIndex);
            for (let i = 0; i < rowInstructionList.length; i++) {
                const instructionElm = document.createElement('asct-instruction');
                instructionElm.index = index + i;
                this.appendChild(instructionElm);
                instructionElm.render(rowInstructionList[i]);
            }
            const deltaElm = document.createElement('asct-delta');
            this.appendChild(deltaElm);
            // deltaElm.render(this.duration);
            // }
        } else {
            // if(this.childNodes.length > 0) {
            this.innerHTML = '';
                // console.info("Clear ", this);
            // }
        }

        return this;
    }

}

customElements.define('asct-row', AudioSourceComposerTrackerRow);


class AudioSourceComposerTrackerInstruction extends HTMLElement {
    constructor() {
        super();
    }
    get row() { return this.parentNode; }
    get tracker() { return this.parentNode.tracker; }
    get editor() { return this.tracker.editor; }

    set index(instructionIndex) {
        this.setAttribute('i', instructionIndex);
        // this.render();
    }
    get index() { return parseInt(this.getAttribute('i'))}

    getInstruction() { return this.row.tracker.getInstruction(this.index); }

    connectedCallback() {
        // this.render();
    }

    select() {
        // Select row
        this.row.select();

        // Remove other cursor elements
        this.tracker.querySelectorAll('asct-instruction.cursor,asct-instruction-add.cursor')
            .forEach((elm) => elm.classList.remove('cursor'));

        this.classList.add('selected');
        this.classList.add('cursor');
    }


    render(instruction=null) {
        instruction = instruction || this.getInstruction();

        let paramElm;
        this.appendChild(paramElm = document.createElement('ascti-command'));
        paramElm.render(instruction);
        this.appendChild(paramElm = document.createElement('ascti-instrument'));
        paramElm.render(instruction);
        this.appendChild(paramElm = document.createElement('ascti-velocity'));
        paramElm.render(instruction);
        this.appendChild(paramElm = document.createElement('ascti-duration'));
        paramElm.render(instruction);
        // this.innerHTML = JSON.stringify(instruction); // .editor.values.format(this.duration, 'duration');
    }

}

customElements.define('asct-instruction', AudioSourceComposerTrackerInstruction);


class AudioSourceComposerTrackerInstructionAdd extends AudioSourceComposerTrackerInstruction {

}
customElements.define('asct-instruction-add', AudioSourceComposerTrackerInstructionAdd);




class AudioSourceComposerTrackerParameter extends HTMLElement {
    constructor() {
        super();
    }
    get instruction() { return this.parentNode; }
    get tracker() { return this.parentNode.parentNode.tracker; }
    get editor() { return this.tracker.editor; }

    connectedCallback() {
        //this.render();
    }

    render() {
        this.innerHTML = this.editor.values.format(this.row.duration, 'duration');
    }
}

class AudioSourceComposerParamCommand extends AudioSourceComposerTrackerParameter {
    render(instruction=null) {
        instruction = instruction || this.instruction.getInstruction();
        this.innerHTML = this.editor.values.format(instruction.command, 'command');
    }
}
customElements.define('ascti-command', AudioSourceComposerParamCommand);

class AudioSourceComposerParamInstrument extends AudioSourceComposerTrackerParameter {
    render(instruction=null) {
        instruction = instruction || this.instruction.getInstruction();
        this.innerHTML = this.editor.values.format(instruction.instrument, 'instrument');
    }
}
customElements.define('ascti-instrument', AudioSourceComposerParamInstrument);

class AudioSourceComposerParamVelocity extends AudioSourceComposerTrackerParameter {
    render(instruction=null) {
        instruction = instruction || this.instruction.getInstruction();
        this.innerHTML = this.editor.values.format(instruction.velocity, 'velocity');
    }
}
customElements.define('ascti-velocity', AudioSourceComposerParamVelocity);

class AudioSourceComposerTrackerDuration extends AudioSourceComposerTrackerParameter {
    render(instruction=null) {
        instruction = instruction || this.instruction.getInstruction();
        this.innerHTML = this.editor.values.format(instruction.duration, 'duration');
    }
}
customElements.define('ascti-duration', AudioSourceComposerTrackerDuration);





class AudioSourceComposerTrackerDelta extends HTMLElement {
    constructor() {
        super();
    }
    get editor() { return this.tracker.editor; }
    get tracker() { return this.parentNode.tracker; }
    get row() { return this.parentNode; }

    // set duration(durationInTicks) { this.setAttribute('d', durationInTicks)}
    // get duration() { return parseInt(this.parentNode.getAttribute('d'))}

    connectedCallback() {
        setTimeout(e => this.render(), 1);
    }

    render(duration) {
        duration = duration || this.row.duration;
        this.innerHTML = this.editor.values.format(duration, 'duration');
    }
}

customElements.define('asct-delta', AudioSourceComposerTrackerDelta);
