#!/usr/bin/python3

import json
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


def save_conf(config_file_path: str, config_file_json: str):

    config_file_fd = open(config_file_path, "w")
    if (config_file_fd):
        config_file_fd.write(config_file_json)
        config_file_fd.close()

if __name__ == '__main__':
    pass
