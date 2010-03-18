// demonstrating the native exec function

include('keysyms.js');
include('keynames.js');

function process(ev) {
	if (ev.type == EV_KEY && ev.code == KEY_F12) {
		if (ev.value == 1)
			exec("ls -la '/tmp'");
		// don't ever emit F12
	} else {
		emit(ev.type, ev.code, ev.value);
	}
}

