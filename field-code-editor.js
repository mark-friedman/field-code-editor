import {EditorView} from 'codemirror';
import {javascript} from '@codemirror/lang-javascript';
import {tooltips} from '@codemirror/view';
import {Compartment} from '@codemirror/state';
import {oneDark} from '@codemirror/theme-one-dark';
import {kiwiSetup} from './codemirror-features.js';

/**
 * Class for an JavaScript code editor field.
 * @extends {Field}
 */
class FieldCodeEditor extends Blockly.Field {
    /**
     * @param {(string|!Sentinel)=} opt_value The initial content of the
     *     field. Should cast to a string. Defaults to an empty string if null or
     *     undefined.
     *     Also accepts Field.SKIP_SETUP if you wish to skip setup (only used by
     *     subclasses that want to handle configuration and setting the field
     *     value after their own constructors have run).
     * @param {Function=} opt_validator An optional function that is called
     *     to validate any constraints on what the user entered.  Takes the new
     *     text as an argument and returns either the accepted text, a replacement
     *     text, or null to abort the change.
     * @param {Object=} opt_config A map of options used to configure the field.
     *     See the [field creation documentation]{@link
        *     https://developers.google.com/blockly/guides/create-custom-blocks/fields/built-in-fields/multiline-text-input#creation}
     *     for a list of properties this parameter supports.
     */
    constructor(opt_value, opt_validator, opt_config) {
        if (opt_value == null) {
            opt_value = '';
        }
        super(opt_value, opt_validator, opt_config);

        this.SERIALIZABLE = true;
    };

    /**
     * A developer hook to override the returned value of this field.
     * @return {?string} Current value.
     */
    getValue() {
        return this.codeEditor ? this.codeEditor.state.doc.toString() : this.value_;
    }

    /**
     * Create the block UI for this field.
     * @package
     */
    initView() {
        this.createCodeEditorElement_();
    };

    createCodeEditorElement_() {
        this.initialWidthNum = 500;
        const initialWidthStr = this.initialWidthNum.toString() + 'px';
        this.initialHeightNum = 200;
        const initialHeightStr = this.initialHeightNum.toString() + 'px';

        this.foreignObject_ = Blockly.utils.dom.createSvgElement('foreignObject', {
            'x': 0,
            'y': 0,
            'width': this.initialWidthNum,
            'height': this.initialHeightNum,
        });
        this.divElement_ = document.createElement('div');
        this.divElement_.style.minHeight = initialHeightStr;
        this.divElement_.style.minWidth = initialWidthStr;
        const codeEditorTheme = EditorView.theme({
            '&': {
                height: 'auto'
            },
            // Comment to enable scrollbar
            '.cm-scroller': {
                overflow: 'auto'
            },
            '.cm-editor': {
                height: 'auto'
            },
        }, {dark: true});
        this.workspace = this.getSourceBlock().workspace;
        // Disable code editing of block when it is the toolbox flyout
        const editable = EditorView.editable.of(!this.workspace.isFlyout);
        // Set up listening to editor changes
        const updateListenerExtension = EditorView.updateListener.of((update) => {
            this.handleEditorViewUpdate_(update);
        });
        // Set up dynamic line wrapping
        this.lineWrapping = false;
        this.lineWrappingComp = new Compartment();
        // create editor
        this.codeEditor = new EditorView({
            doc: this.value_ || '// Insert code here\n\n\n',
            parent: this.divElement_,
            extensions: [
                kiwiSetup,
                javascript(),
                oneDark,
                codeEditorTheme,
                editable,
                tooltips({parent: document.body}),
                updateListenerExtension,
                this.lineWrappingComp.of(this.lineWrapping ? EditorView.lineWrapping : [])]
        })
        this.foreignObject_.appendChild(this.divElement_);
        this.fieldGroup_.appendChild(this.foreignObject_);
        this.size_.width = this.initialWidthNum;
        this.size_.height = this.initialHeightNum;
    }

    /**
     * Handle changes to the editor.
     *
     * The basic purpose of this method is to change the height and width of the Blockly block
     * to match the height and width of the code in the editor.  We need to do this because
     * CodeMirror wants to fit within the contents of its container, and will either scroll or
     * wrap to do so.  However, the behavior that we want to expand the container to fit the code,
     * up to a point, and then wrap.  So, we do some hairy stuff to try to keep the block big enough
     * to fit the code.
     */
    handleEditorViewUpdate_(update) {
        try {
            // Note that there is a weirdness whereby recursive calls to handleEditorViewUpdate_ can be triggered
            // by CodeMirror due to the calls to coordsAtPos within computeLineWidth.  This may cause issues.
            // Consequently, we want to just ignore those recursive calls.
            if (update.geometryChanged && !this.withinHandleEditorViewUpdate_) {
                this.withinHandleEditorViewUpdate_ = true;
                // Resize editor's parent's width to match the editor's width
                let maxLineWidth = 0;
                for (let i = 1; i <= this.codeEditor.state.doc.lines; i++) {
                    const line = this.codeEditor.state.doc.line(i);
                    const lineWidth = this.computeLineWidth(line);
                    if (lineWidth > maxLineWidth) {
                        maxLineWidth = lineWidth;
                    }
                }
                const lineNumberWidth = 30;
                const possibleNewWidth = Math.max(maxLineWidth + lineNumberWidth, this.initialWidthNum);
                // We only increase the width upto a point.  After that we start line wrapping
                const LINE_WRAP_MULTIPLIER = .7;
                const maxAllowableWidth =
                    (getBlocklyDivWidth(this.workspace) - getBlocklyToolboxDivWidth()) * LINE_WRAP_MULTIPLIER;
                const oldLineWrapping = this.lineWrapping;
                this.lineWrapping = possibleNewWidth > maxAllowableWidth;
                if (this.lineWrapping) {
                    this.size_.width = maxAllowableWidth;
                    if (this.lineWrapping !== oldLineWrapping) {
                        this.codeEditor.dispatch({
                            effects: this.lineWrappingComp.reconfigure(EditorView.lineWrapping)
                        });
                    }
                } else {
                    this.size_.width = possibleNewWidth;
                    if (this.lineWrapping !== oldLineWrapping) {
                        this.codeEditor.dispatch({
                            effects: this.lineWrappingComp.reconfigure([])
                        });
                    }
                }
                this.size_.height = this.codeEditor.contentDOM.offsetHeight;
                this.divElement_.style.width = this.size_.width + 'px';
                this.divElement_.style.height = this.size_.height + 'px';
                this.foreignObject_.style.width = this.size_.width + 'px';
                this.foreignObject_.style.height = this.size_.height + 'px';
                this.isDirty_ = true;
                this.forceRerender();
            }
        } finally {
            this.withinHandleEditorViewUpdate_ = false;
        }
    }

    /**
     * This method computes the potential width of a line in the editor.
     *
     * By potential width, we mean the width of the line as if it wasn't wrapped. When we're not in
     * line wrapping mode the computation is fairly simple.  However, when it is in wrapping mode
     * we need to do a more complicated calculation.
     */
    computeLineWidth(line) {
       let lineWidth = 0;
        if (this.lineWrapping) {
            // In the case of line wrapping mode there are potentially multiple rendered lines for each
            // line of code.  We need to find the width of the widest rendered line.

            // Generate the coordinates for the set of rendered lines
            const renderedLines = [];
            let lastRightCoord = 0;
            let startPos = line.from;
            for (let pos = line.from; pos < line.to; pos++) {
                const coords = this.codeEditor.coordsAtPos(pos);
                if (!coords) {
                    return 0;
                }
                if (coords.right < lastRightCoord) {
                    // We've wrapped around, so let's record a rendered line
                    renderedLines.push({
                        from: startPos,
                        to: pos - 1
                    });
                    startPos = pos;
                }
                lastRightCoord = coords.right;
            }
            renderedLines.push({
                from: startPos,
                to: line.to
            });

            // Compute the set of rendered line widths
            const renderedLineWidths = renderedLines.map((renderedLine) => {
                const endOfLineCoords = this.codeEditor.coordsAtPos(renderedLine.to);
                if (!endOfLineCoords) {
                    return 0;
                }
                const begOfLineCoords = this.codeEditor.coordsAtPos(renderedLine.from);
                const width = endOfLineCoords.right - begOfLineCoords.left;
                return width;
            });

            // Sum the rendered line widths to get the potential width of the line if there was no wrapping
            lineWidth = renderedLineWidths.reduce(
                ((prev, curr) => prev + curr),
                0);
        } else {
            const endOfLinePos = line.to;
            const endOfLineCoords = this.codeEditor.coordsAtPos(endOfLinePos);
            if (!endOfLineCoords) {
                return 0;
            }
            const begOfLinePos = line.from;
            const begOfLineCoords = this.codeEditor.coordsAtPos(begOfLinePos);
            lineWidth = endOfLineCoords.right - begOfLineCoords.left;
        }
        return lineWidth;
    }
}

function getBlocklyDivWidth(workspace) {
    return workspace.getInjectionDiv().offsetWidth;
}

function getBlocklyToolboxDivWidth() {
    return document.getElementsByClassName('blocklyToolboxDiv')[0].offsetWidth;
}

FieldCodeEditor.fromJson = function(options) {
    const text = Blockly.utils.replaceMessageReferences(options['text']);
    return new FieldCodeEditor(text, undefined, options);
};

// Check if browser is Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
Blockly.fieldRegistry.register('field_code_editor', isSafari ? Blockly.FieldMultilineInput : FieldCodeEditor);
