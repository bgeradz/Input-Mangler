/* This example shows you how you can control your mouse with keyboard */

include('keysyms.js');
include('keynames.js');

var AUX_TIMEOUT = 200; // ms

var auxTime = null;
var aux = false;
var auxKeys = {};

var mouse = {
	minSpeed : 0.1,
	maxSpeed : 5,
	factor : 1.15,
	axisX : {
		dir : 0,
		speed : 0,
		rest : 0,
		relEv: REL_X
	},
	axisY : {
		dir : 0,
		speed : 0,
		rest : 0,
		relEv: REL_Y
	}
}

// key bindings in aux mode 
AUX_SWITCH = KEY_SPACE; // key that triggers the aux mode

AUX_MOUSE_LEFT = KEY_S; // mouse emulation
AUX_MOUSE_RIGHT = KEY_F;
AUX_MOUSE_UP = KEY_E;
AUX_MOUSE_DOWN = KEY_D;
AUX_MOUSE_BTN_LEFT = KEY_W;
AUX_MOUSE_BTN_RIGHT = KEY_R;


/* This is the entry point of event processing */
function process(ev){
	switch (ev.type) {
		case EV_KEY:
			processKey(ev);
			break;
		case EV_TIMER:
			processTimer();
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
	if (! key.cancel)
		emitKey(key.code, key.value);
}

function emitKey(code, value) {
	log("EMIT KEY: "+ sym(code) +" "+ value);
	emit(EV_KEY, code, value); // emitting key event into the system
}
function emitRel(code, value) {
	emit(EV_REL, code, value);
}

function keyPress(key, rep) {
	var proc = true;
	switch (key.code) {
		case AUX_SWITCH:
			var t = time();
			if (auxTime)
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
		proc = auxTranslateMouse(key, 1);
		if (! proc) // suppress all unknown keys in aux
			key.cancel = true;
	} else {
		if (auxKeys[key.code]) {
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
				emitKey(AUX_SWITCH, 1);
				emitKey(AUX_SWITCH, 0);
			}
			aux = false;
			break;
		default:
			proc = false;		
	}
	if (proc)
		return;

	if (key.code == KEY_102ND) {
		key.code = KEY_LEFTSHIFT;
		return;
	}

	var code = key.code;
	proc = true;
	if (aux) {
		proc = auxTranslateMouse(key, 0);
	} else {
		if (auxKeys[key.code]) {
			proc = auxTranslateMouse(key, 0);
		}		
	}
	if (! proc) // suppress all unknown keys in aux
		key.cancel = true;
	
	delete auxKeys[code];
}

function auxTranslateMouse(key, value) {
	var proc = true;
	switch (key.code) {
		// mouse
		case AUX_MOUSE_LEFT:
			mouse.axisX.dir = value ? -1 : 0;
			break;
		case AUX_MOUSE_RIGHT:
			mouse.axisX.dir = value ? 1 : 0;
			break;
		case AUX_MOUSE_UP:
			mouse.axisY.dir = value ? -1 : 0;
			break;
		case AUX_MOUSE_DOWN:
			mouse.axisY.dir = value ? 1 : 0;
			break;

		case AUX_MOUSE_BTN_LEFT:
			emitKey(BTN_LEFT, value);
			emit(EV_SYN, SYN_REPORT, 0);
			break;
		case AUX_MOUSE_BTN_RIGHT:
			emitKey(BTN_RIGHT, value);
			emit(EV_SYN, SYN_REPORT, 0);
			break;

		default:
			proc = false;
	}
	if (proc)
		key.cancel = true;
	return proc;
}

function processTimer(){
	var resX = processMouseEmu(mouse.axisX);
	var resY = processMouseEmu(mouse.axisY);
	if (resX || resY)
		emit(EV_SYN, SYN_REPORT, 0);
}

function processMouseEmu(axis) {
	if (axis.dir) {
		if (axis.speed == 0) {
			axis.speed = mouse.minSpeed * axis.dir;
		}
		else if (axis.dir * axis.speed > 0) {// same direction
			axis.speed *= mouse.factor;
			if (abs(axis.speed) > mouse.maxSpeed)
				axis.speed = mouse.maxSpeed * axis.dir;			
		} else { // differend directions
			axis.speed /= mouse.factor;
			axis.speed /= mouse.factor;
			if (abs(axis.speed) < mouse.minSpeed)
				axis.speed = 0;
		}
	} else { // speed down
		if (axis.speed != 0) {
			axis.speed /= mouse.factor;
			if (abs(axis.speed) < mouse.minSpeed)
				axis.speed = 0;
		}
	}

	if (axis.speed != 0) {
		axis.rest += axis.speed;
		var full;
		if (axis.rest > 0) {
			full = floor(axis.rest);
			axis.rest -= full;
		} else {
			full = ceil(axis.rest);
			axis.rest -= full;
		}		
		if (full != 0) {
			emitRel(axis.relEv, full);
			return true;
		}
	}
	return false;
}
		

