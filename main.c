#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>

#include <sys/ioctl.h> 

#include <linux/input.h>
#include <linux/uinput.h>

// this is for timer pseudo event
#define EV_TIMER 0x20

#include "scripting.h"

int input_fd, uinput_fd;
struct input_event ev;
struct uinput_user_dev dev;

// in usec
#define TIMER_INTERVAL (1000000 / 100) // 1/100 sec.

void emitEvent(int type, int code, int value) {
	ev.type = type;
	ev.code = code;
	ev.value = value;
	/*
	printf("EMIT: type: %d  code: %d  value: %d\n",
		ev.type, ev.code, ev.value);
	*/
	write(uinput_fd, &ev, sizeof(ev));
}

int rescue_keys[] = {
	KEY_RIGHTSHIFT,
	KEY_RIGHTCTRL,
};
#define rescue_len (sizeof(rescue_keys) / sizeof(int))

int main(int argc, char **argv)
{
	int i;
	int res;
	int interrupt = 0;
	int one = 1;

	int rescue_state[rescue_len];
	for (i = 0; i < rescue_len; i++)
		rescue_state[i] = 0;

	if (argc != 3 && argc != 4)
	{
		fprintf(stderr, "Usage: jskbd input_device uinput_device [main-script]\n",
			strerror(errno));
		exit(1);
	}

	// preparing input device
	input_fd = open(argv[1], O_RDONLY);
	if (input_fd < 0)
	{
		fprintf(stderr, "could not open input device %s: %s\n", argv[1],
			strerror(errno));
		exit(2);
	}

	if (ioctl(input_fd, EVIOCGRAB, (void *)1) < 0)
	{
		fprintf (stderr, "unable to grab device '%s' : %s\n", argv[1],
		strerror(errno));
	}
	if (ioctl(input_fd, FIONBIO, (void *)&one) < 0)
	{
		fprintf (stderr, "unable to set device '%s' to non-blocking mode : %s\n", argv[1],
		strerror(errno));
	}

	// preparing uinput device
	uinput_fd = open(argv[2], O_WRONLY | O_NDELAY);
	if (uinput_fd < 0)
	{
		fprintf(stderr, "could not open uinput device %s: %s\n", argv[2],
			strerror(errno));
		exit(2);
	}

	sprintf(dev.name, "uinput keyboard driver");
	write(uinput_fd, &dev, sizeof(dev));

	/* keyboard stuff */
	if (ioctl(uinput_fd, UI_SET_EVBIT, EV_KEY) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	}
	if (ioctl(uinput_fd, UI_SET_EVBIT, EV_REP) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	
	}
	for (i = 1; i < KEY_UNKNOWN; i++)
	{
		if (ioctl(uinput_fd, UI_SET_KEYBIT, i) < 0)
		{
			fprintf(stderr, "error registering key %d at line %d: %s\n",
			i, __LINE__, strerror(errno));
		}
	}

	/* mouse stuff */
	if (ioctl(uinput_fd, UI_SET_EVBIT, EV_REL) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	}
	if (ioctl(uinput_fd, UI_SET_RELBIT, REL_X) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	}
	if (ioctl(uinput_fd, UI_SET_RELBIT, REL_Y) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	}
	if (ioctl(uinput_fd, UI_SET_KEYBIT, BTN_LEFT) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	}

	/* *********** */
	if (ioctl(uinput_fd, UI_DEV_CREATE, 0) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	}

	if (argc == 3) {
		res = InitScripting("js/main.js");
	} else {
		res = InitScripting(argv[3]); // custom main script
	}

	if (res) {

		// for (i = 0; i < 100; i++) // uncomment instead of 'while', in worst case system becomes vitable after 100 events
		while (! interrupt)
		{
			char *ptr = (char *)&ev;
			/*
			char *end = ptr + sizeof(ev);
			while (res = read(input_fd, ptr, end - ptr) > 0)
			{
				if (res == end - ptr)
					break;
				ptr += res;
			}
			*/
			if (res = read(input_fd, ptr, sizeof(ev)) <= 0)
			{
				ProcessEvent(EV_TIMER, ev.code, ev.value);
				usleep(TIMER_INTERVAL);
				continue;	
			} 
		
			if (ev.type == EV_KEY)
			{
				int all = 1;
				for (i = 0; i < rescue_len; i++) {
					if (rescue_keys[i] == ev.code)
						rescue_state[i] = (ev.value == 0 ? 0 : 1);
					all = all && rescue_state[i];
				}
				if (all)
					interrupt = 1;

				/*
				printf("type: %d  code: %d  value: %d\n",
					ev.type, ev.code, ev.value);
				*/
				ProcessEvent(ev.type, ev.code, ev.value);
				// write(uinput_fd, &ev, sizeof(ev));
			}
		}
	} else {
		fprintf(stderr, "Error initializing scripting\n");
	}

	DestroyScripting();

	close(input_fd);
	close(uinput_fd);
}

