#ifndef __SCRIPTING_H__
#define __SCRIPTING_H__

#ifndef BOOL
#define BOOL int
#endif

#ifndef TRUE
#define TRUE 1
#endif

#ifndef FALSE
#define FALSE 0
#endif


BOOL InitScripting(char *main_script_path);
BOOL DestroyScripting();
BOOL ProcessEvent(int type, int code, int value);

#endif // __SCRIPTING_H__

