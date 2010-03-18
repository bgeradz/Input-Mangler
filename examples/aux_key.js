include('keysyms.js');
include('keynames.js');

var AUX_TIMEOUT = 200; // ms

var auxTime = null;
var aux = false;
var auxKeys = {};

// key bindings in aux mode 
AUX_SWITCH = KEY_SPACE; // key that triggers the aux mode

AUX_LEFT = KEY_S;
AUX_RIGHT = KEY_F;
AUX_UP = KEY_E;
AUX_DOWN = KEY_D;

AUX_HOME = KEY_W;
AUX_END = KEY_R;
AUX_PAGEUP = KEY_Q;
AUX_PAGEDOWN = KEY_A;

AUX_ENTER = KEY_SEMICOLON;

AUX_DELETE = KEY_G; // delete & backspace
AUX_BACKSPACE = KEY_H;


/* This is the entry point of event processing, this function will be called by the system for every key event.
 * IMPORTANT NOTE: this function must eventually emit some events back to the system otherwise your system
 * completely stops responding to keyboard!!!
 * Normally you want to emit almost all events with an exception of some keys you wish to process in a different way.
 */
function process(ev){
	switch (ev.type) {
		case EV_KEY:
			processKey(ev);
			break;
		default:
			emit(ev.type, ev.code, ev.value);
	}
}

function processKey(key) {
	log('INPUT : '+ key.code+ ' '+sym(key.code) +' '+ key.value);
	if (key.value > 0)
		keyPress(key, key.value == 2);
	else
		keyRelease(key);
	if (! key.cancel) // if processing routines haven't marked the event to be ignored, emit it back to the system
		emitKey(key.code, key.value);
}


function emitKey(code, value) {
	log("EMIT KEY: "+ sym(code) +" "+ value);
	emit(EV_KEY, code, value); // emitting key event into the system
}

function keyPress(key, rep) {
	var proc = true;
	switch (key.code) {
		case AUX_SWITCH:
			var t = time();
			if (! auxTime)
				auxTime = t;
			key.cancel = true;
			aux = true;
			break;
		default: 
			proc = false;
	}
	if (proc)
		return;

	if (aux) {
		auxKeys[key.code] = true;
		proc = auxTranslateSequences(key);
		if (! proc)
			proc = auxTranslateKey(key);
		if (! proc) // suppress all unknown keys in aux mode
			key.cancel = true;
	} else {
		if (auxKeys[key.code]) {
			proc = auxTranslateKey(key);
			if (! proc) // suppress all unknown keys in aux
				key.cancel = true;			
		}		
	}
}

function keyRelease(key) {
	var proc = true;
	switch (key.code) {
		case AUX_SWITCH:
			key.cancel = true;
			var curTime = time();
			if (curTime - auxTime <= AUX_TIMEOUT) {
				// emit the original AUX_SWITCH key press/release
				emitKey(AUX_SWITCH, 1);
				emitKey(AUX_SWITCH, 0);
			}
			aux = false;
			auxTime = null;
			break;
		default:
			proc = false;		
	}
	if (proc)
		return;

	var code = key.code;
	proc = true;
	if (aux) {
		proc = auxTranslateKey(key);
	} else {
		if (auxKeys[key.code]) {
			proc = auxTranslateKey(key);
		}		
	}
	if (! proc) // suppress all unknown keys in aux
		key.cancel = true;
	
	delete auxKeys[code];
}

function auxTranslateKey(key) {
	/* aux handling */
	var proc = true;
	switch (key.code) {
		// arrows
		case AUX_LEFT:
			key.code = KEY_LEFT;
			break;
		case AUX_RIGHT:
			key.code = KEY_RIGHT;
			break;
		case AUX_UP:
			key.code = KEY_UP;
			break;
		case AUX_DOWN:
			key.code = KEY_DOWN;
			break;

		// home / end
		case AUX_HOME:
			key.code = KEY_HOME;
			break;
		case AUX_END:
			key.code = KEY_END;
			break;
		
		// page up/down
		case AUX_PAGEUP:
			key.code = KEY_PAGEUP;
			break;
		case AUX_PAGEDOWN:
			key.code = KEY_PAGEDOWN;
			break;

		// backspace / delete
		case AUX_BACKSPACE:
			key.code = KEY_BACKSPACE;
			break;
		case AUX_DELETE:
			key.code = KEY_DELETE;
			break;

		case AUX_ENTER:
			key.code = KEY_ENTER;
			break;


		// pass through register keys
		case KEY_LEFTSHIFT:
		case KEY_RIGHTSHIFT:
		case KEY_LEFTCTRL:
		case KEY_RIGHTCTRL:
			break;

		default:
			proc = false; // not processed by this function
	}
	return proc;
}

function auxTranslateSequences(key) {
	var proc = true;
	switch (key.code) {
		// ctrl + keys
		case KEY_Z:
			emitKeySequence([KEY_RIGHTCTRL, KEY_Z]);
			break;
		case KEY_X:
			emitKeySequence([KEY_RIGHTCTRL, KEY_X]);
			break;
		case KEY_C:
			emitKeySequence([KEY_RIGHTCTRL, KEY_C]);
			break;
		case KEY_V:
			emitKeySequence([KEY_RIGHTCTRL, KEY_V]);
			break;
		
		case KEY_B:
			emitKeySequence([KEY_RIGHTCTRL, KEY_S]);
			break;
		case KEY_N:
			emitKeySequence([KEY_RIGHTALT, KEY_LEFT]);
			break;
		case KEY_M :
			emitKeySequence([KEY_RIGHTALT, KEY_RIGHT]);
			break;

		default:
			proc = false; // not processed by this function
	}
	if (proc)
		key.cancel = true;	
	return proc;
}

// a handy function to emit a sequence of keypresses/releases
function emitKeySequence(keys) {
	var i;
	for (i = 0; i < keys.length; i++)
		emitKey(keys[i], 1);
	for (i = keys.length - 1; i >= 0; i--)
		emitKey(keys[i], 0);
} 

