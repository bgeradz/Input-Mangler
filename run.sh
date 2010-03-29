#!/bin/sh

# run this script as root or someone having access to the input devices

# If /dev/uinput or /dev/input/uinput device file is not present issue:
# $ modprobe uinput

# You must find your event device files instead of /dev/input/event3,4 below.
# Do so by issuing:
# $ cat /dev/input/event...
# for every event device file until you find the ones that output garbage to the terminal
# in response to your typing or mouse movements
# NOTE: kbd-mangler is not limited to keyboard and mouse events
#       With multiple -r options you can read any number of input devices of any kind.
# NOTE: /dev/input/mice does NOT work, appears to work differently from event* devices.
# NOTE: Be careful if you decide not to read the keyboard device. In this case the
#       magic rescue sequence will not be available.

modprobe uinput

KBD_DEV=/dev/input/event3
MOUSE_DEV=/dev/input/event4

# may also be /dev/input/uinput
UINPUT_DEV=/dev/uinput

# find out directory where this script resides
DIR=$(cd $(dirname "$0"); pwd)

sleep 1 # against initial ENTER key hanging when starting this script from shell

echo Starting input-mangler...

# need this if your spidermonkey library resides in some obscure place (as in my case on ubuntu)
export LD_LIBRARY_PATH=/usr/lib/xulrunner-devel-1.9.1.8/sdk/lib

$DIR/input-mangler -I $DIR/jslib -r $MOUSE_DEV -r $KBD_DEV -w $UINPUT_DEV $@

