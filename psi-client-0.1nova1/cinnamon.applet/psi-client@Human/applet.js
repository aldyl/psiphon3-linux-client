const Lang = imports.lang; // This applet functions
const Applet = imports.ui.applet; // This kind of applet
const GLib = imports.gi.GLib; //Create a process
const Gio = imports.gi.Gio; //File operations
const Settings = imports.ui.settings; // Create setting
const MainLoop = imports.mainloop; // Makes a command Loop
const St = imports.gi.St; // For menu icons
const PopupMenu = imports.ui.popupMenu; // Create the PopUp Menu

const UUID = "psi-client@Human";

function PsiClientApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
}

PsiClientApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function (metadata, orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(
      this,
      orientation,
      panel_height,
      instance_id
    );
    try {
      //State icons
      this.icon_connected = (metadata.path + "/Data/connected.svg")
        .toString()
        .trim();
      this.icon_active = (metadata.path + "/Data/await.svg").toString().trim();
      this.icon_inactive = (metadata.path + "/Data/inactive.svg")
        .toString()
        .trim();

      this.set_applet_icon_path(this.icon_inactive);

      //Variables
      this.isLooping = true;
      this.previousState = "exited";
      this.waitForCmd = false;

      //Configuration menu
      this.state = {};
      this.settings = new Settings.AppletSettings(
        this.state,
        metadata.uuid,
        instance_id
      );

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "location",
        "location",
        () => this.on_settings_location_changed(),
        null
      );

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "interval",
        "interval"
      );

      // Create the popup menu
      this.menuItemsInfo = [];
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);

      //Detect valid path
      if (!this.found_service) this.detectService();

      //Check service status
      this.check_service_status();
      this.loopId = MainLoop.timeout_add(this.state.interval, () =>
        this.check_service_status()
      );
    } catch (e) {
      global.logError(e);
    }
  },

  on_settings_location_changed: function () {
    this.check_service_status_async("--set_country=" + this.state.location);
    this.check_service_status_async("--restart");
  },

  detectService: function () {
    let resp = this.check_service_status_async("--start");
    if (resp) {
      this.set_applet_tooltip(" " + _("Service found "));
    } else {
      this.set_applet_tooltip(" " + _("Please install psi-client service"));
    }
  },

  get_ip_menu_information: async function () {
    let items_info = []; //Items for menu

    if (this.previousState.lastIndexOf("connected") > -1) {
      let args = [
        "psi-client",
        "--location_info",
        "--location_country",
        "--location_city",
        "--location_ip",
      ];

      let out = await this.exec_sync_command(args);

      items_info.push("✅️".concat(out.trim().replace(/connected/g, "Location✅️")));

      this.menuItemsInfo = items_info;
    } else {
      this.menuItemsInfo = items_info;
    }
  },

  exec_sync_command: function (argv, input = null, cancellable = null) {
    let flags = Gio.SubprocessFlags.STDOUT_PIPE;

    if (input !== null) flags |= Gio.SubprocessFlags.STDIN_PIPE;

    let proc = new Gio.Subprocess({
      argv: argv,
      flags: flags,
    });
    proc.init(cancellable);

    return new Promise((resolve, reject) => {
      proc.communicate_utf8_async(input, cancellable, (proc, res) => {
        try {
          resolve(proc.communicate_utf8_finish(res)[1]);
        } catch (e) {
          reject(e);
        }
      });
    });
  },

  on_applet_clicked: function () {
    this.get_ip_menu_information();
    this.buildMenu(this.menuItemsInfo);
    this.menu.toggle();
  },

  on_applet_removed_from_panel: function () {
    MainLoop.source_remove(this.loopId);
    this.loopId = 0;
    this.isLooping = false;
    this.settings.finalize();
  },

  buildMenu: function (items_info) {
    this.menu.removeAll();

    let isOpen = this.menu.isOpen;

    let section_info = new PopupMenu.PopupMenuSection();
    if (items_info.length > 0) {
      for (let i = 0; i < items_info.length; i++) {
        let item = new PopupMenu.PopupMenuItem(items_info[i]);
        section_info.addMenuItem(item);
      }
    }
    this.menu.addMenuItem(section_info);

    let connect_button = new PopupMenu.PopupIconMenuItem(
      _("Connect ") + this.state.location,
      "security-high-symbolic",
      St.IconType.SYMBOLIC
    );

    let connect_button_id = connect_button.connect(
      "activate",
      Lang.bind(this, this._connect_button)
    );

    let disconnect_button = new PopupMenu.PopupIconMenuItem(
      _("Disconnect"),
      "security-low-symbolic",
      St.IconType.SYMBOLIC
    );
    let disconnect_button_id = disconnect_button.connect(
      "activate",
      Lang.bind(this, this._disconnect_button)
    );

    let section_buttons = new PopupMenu.PopupMenuSection();

    if (this.previousState.lastIndexOf("connected") > -1) {
      section_buttons.addMenuItem(disconnect_button);
    } else {
      section_buttons.addMenuItem(connect_button);
    }

    this.menu.addMenuItem(section_buttons);

    if (isOpen) {
      this.menu.open();
    }
  },

  check_service_status_async: function (action) {
    return GLib.spawn_command_line_async("psi-client " + action);
  },

  _connect_button: function (option, event) {
    this.check_service_status_async("--restart");
  },

  _disconnect_button: function (option, event) {
    this.check_service_status_async("--stop");
  },

  check_service_status: function () {
    if (!this.isLooping) {
      return false;
    }

    try {
      if (!this.waitForCmd) {
        this.waitForCmd = true;
        this.check_service_status_icon();
      }
    } catch (e) {
      global.logError(e);
      return false;
    }

    return true;
  },

  check_service_status_icon: function () {
    let textOut = " " + GLib.spawn_command_line_sync("psi-client --status");

    if (textOut.lastIndexOf(this.previousState) < 0) {
      if (textOut.lastIndexOf("connected") > -1) {
        this.set_applet_icon_path(this.icon_connected);
        this.set_applet_tooltip(_("Connected"));
        this.previousState = "connected";
        this.get_ip_menu_information();
      }

      if (textOut.lastIndexOf("await") > -1) {
        this.set_applet_icon_path(this.icon_active);
        this.set_applet_tooltip(_("Await"));
        this.previousState = "await";
      }

      if (textOut.lastIndexOf("exited") > -1) {
        this.set_applet_icon_path(this.icon_inactive);
        this.set_applet_tooltip(_("Disconnected"));
        this.previousState = "exited";
      }
    }

    this.waitForCmd = false;
    return true;
  },
};

function main(metadata, orientation, panel_height, instance_id) {
  return new PsiClientApplet(metadata, orientation, panel_height, instance_id);
}
