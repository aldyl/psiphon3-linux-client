#!/usr/bin/python3

from subprocess import Popen, PIPE

def _run_cmd(cmd, **input_data):
    process = Popen(cmd, stdin=PIPE, stdout=PIPE,
                    stderr=PIPE, shell=True, text=True)
    out, err = process.communicate(
        **input_data
    )

    return process.returncode, out, err

def exec_service(action: str):
    cmd = "service psi-client " + action

    Popen(cmd, stdin=PIPE, stdout=PIPE,
          stderr=PIPE, shell=True, text=True)


if __name__ == '__main__':
    pass
