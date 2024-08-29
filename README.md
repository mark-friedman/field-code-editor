# field-code-editor
This is (or at least will be) a blockly plugin that provides a field that allows the user to edit 
textual code.  It is based on code originally written for [Gamefroot](https://gamefroot.com), 
an online cloud based platform for making 2D games based on Blockly and PhaserJS (among other things).

A couple of notes about the code. It is based on an old version of Blockly, so it might need some 
changes to work with the latest version.  It uses Codemirror for its core functionality.  

There are also a couple of caveats/bugs.  The combination of Blockly, foreignObject and Codemirror 
(or maybe a bug with my code) has issues on Safari, so the code currently falls back to a simple 
multiline field if it detects that it is running in Safari.  Also the field currently also has 
issues if the Blockly workspace is scaled, so you might want to disable the workspace's zoom option.

Note that there is no package.json file yet, but here are the current dependencies:
* "@codemirror/lang-javascript": "^6.0.2",
* "@codemirror/state": "^6.1.1",
* "@codemirror/theme-one-dark": "^6.1.0",
* "@codemirror/view": "^6.2.1",
* "codemirror": "^6.0.1"
