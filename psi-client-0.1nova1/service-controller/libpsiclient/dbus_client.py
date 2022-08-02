import dbus
import sys

INTERFACE_NAME = "cu.human.psiclient.controller"


class PsiController:
    OBJECT_PATH = "/cu/human/psiclient/controller"

    def __init__(self):
        bus = dbus.SystemBus()
        try:
            self.proxy = bus.get_object(INTERFACE_NAME, self.OBJECT_PATH)
            self.iface = dbus.Interface(self.proxy, INTERFACE_NAME)
        except dbus.DBusException:
            sys.exit(1)

    def _exec_service(self, action):
        self.iface._exec_service(action)

    def _save_conf(self, config_file_path, config_file_tmp_path):
        self.iface._save_conf(config_file_path, config_file_tmp_path)

psi_controller = None

def get_psi_controller():
    global psi_controller
    if not psi_controller:
        dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
        psi_controller = PsiController()
    return psi_controller
