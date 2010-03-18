// accelerates the mouse by the given factor

include('keysyms.js');
include('keynames.js');

factor = 4;

function process(ev) {
	if (ev.type == EV_REL)
		ev.value *= factor;
	emit(ev.type, ev.code, ev.value);
}

