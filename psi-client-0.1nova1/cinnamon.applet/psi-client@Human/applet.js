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

      //Variables
      this.numberCall = 0;
      this.isLooping = true;
      this.previousState = "exited";
      this.connect_button = null;
      this.disconnect_button = null;
      this.section_info = null;
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
        () => this.on_settings_changed(),
        null
      );

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "interval",
        "interval",
        () => this.on_settings_changed_interval(),
        null
      );

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "use-upstream-proxy",
        "use_upstream_proxy",
        () => this.on_settings_changed(),
        null
      );

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "upstream-proxy",
        "upstream_proxy",
        () => this.on_settings_changed(),
        null
      );

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "use-split-tunnel",
        "use_split_tunnel",
        () => this.on_settings_changed(),
        null
      );

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "use-indistinguishable-tls",
        "use_indistinguishable_tls",
        () => this.on_settings_changed(),
        null
      );

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "set-local-proxy-port",
        "set_local_proxy_port",
        () => this.on_settings_changed(),
        null
      );

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "set-local-socks-proxy-port",
        "set_local_socks_proxy_port",
        () => this.on_settings_changed(),
        null
      );

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "use-any-interface",
        "use_any_interface",
        () => this.on_settings_changed(),
        null
      );

     
      // Create the popup menu
      this.menuItemsInfo = [];
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);

      //Check service status
      this.check_service_status();
      this.loopId = MainLoop.timeout_add(this.state.interval, () =>
        this.check_service_status()
      );

      this.set_applet_icon_path(this.icon_active);
    } catch (e) {
      global.logError(e);
    }
  },

  on_settings_changed_interval: function () {
    if (this.loopId > 0) {
      MainLoop.source_remove(this.loopId);
    }
    this.loopId = 0;
    this.check_service_status();
    this.loopId = MainLoop.timeout_add(this.state.interval, () =>
      this.check_service_status()
    );
  },

  on_settings_changed: function () {
    let actions = "";

    if (this.state.use_split_tunnel) actions += " --use_split_tunnel";
    else actions += " --no_use_split_tunnel";

    if (this.state.use_indistinguishable_tls)
      actions += " --use_indistinguishable_tls";
    else actions += " --no_use_indistinguishable_tls";

    if (this.state.use_upstream_proxy)
      actions += " --set_upstream_proxy=" + this.state.upstream_proxy;
    else actions += " --set_upstream_proxy=";

    actions += " --set_country=" + this.state.location;

    actions += " --set_local_proxy_port=" + this.state.set_local_proxy_port;

    actions +=
      " --set_local_socks_proxy_port=" + this.state.set_local_socks_proxy_port;

    if (this.state.use_any_interface) actions += " --set_listen_interface=any";
    else actions += " --set_listen_interface=127.0.0.1";

    this.check_service_status_async(actions);

    this.check_service_status_async("--restart");
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

      items_info.push(
        "✅️".concat(out.trim().replace(/connected/g, "Location✅️"))
      );

      this.menuItemsInfo = items_info;
    } else {
      this.menuItemsInfo = items_info;
    }
  },

  on_applet_clicked: function () {
    this.get_ip_menu_information();
    this.buildMenu(this.menuItemsInfo);
    this.menu.toggle();
  },

  on_applet_removed_from_panel: function () {
    this.menu.removeAll();
    MainLoop.source_remove(this.loopId);
    this.loopId = 0;
    this.isLooping = false;
    this.settings.finalize();
  },

buildButtons: function() {
  this.connect_button = new PopupMenu.PopupIconMenuItem(
    _("Connect ") + this.state.location,
    "security-high-symbolic",
    St.IconType.SYMBOLIC
  );

  this.connect_button_id = this.connect_button.connect(
    "activate",
    Lang.bind(this, this._connect_button)
  );

  this.disconnect_button = new PopupMenu.PopupIconMenuItem(
    _("Disconnect"),
    "security-low-symbolic",
    St.IconType.SYMBOLIC
  );

  this.disconnect_button_id = this.disconnect_button.connect(
    "activate",
    Lang.bind(this, this._disconnect_button)
  );
},


  buildMenu: function (items_info) {
    this.menu.removeAll();

    let isOpen = this.menu.isOpen;
    
    this.section_info = new PopupMenu.PopupMenuSection();
    if (items_info.length > 0) {
      for (let i = 0; i < items_info.length; i++) {
        let item = new PopupMenu.PopupMenuItem(items_info[i]);
        this.section_info.addMenuItem(item);
      }
    }

    this.menu.addMenuItem(this.section_info);

    let section_buttons = new PopupMenu.PopupMenuSection();

    this.buildButtons();
    if (this.previousState.lastIndexOf("connected") > -1) {
      section_buttons.addMenuItem(this.disconnect_button);
    } else {
      section_buttons.addMenuItem(this.connect_button);
    }

    this.menu.addMenuItem(section_buttons);

    if (isOpen) {
      this.menu.open();
    }
  },

  check_service_status_async: function (action) {
    //global.log("Async call #" + this.numberCall + action);
   // this.numberCall += 1;

    return GLib.spawn_command_line_async("psi-client " + action);
  },

  exec_sync_command: function (argv, input = null, cancellable = null) {
    //global.log("Sys Gio call #" + this.numberCall + argv);

    //this.numberCall += 1;

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

  check_service_status_icon: async function () {
    let args = ["psi-client", "--status"];

    let out = await this.exec_sync_command(args);

    if (out.lastIndexOf(this.previousState) < 0) {
      if (out.lastIndexOf("connected") > -1) {
        this.set_applet_icon_path(this.icon_connected);
        this.set_applet_tooltip(_("Connected"));
        this.previousState = "connected";
        this.get_ip_menu_information();
      }

      if (out.lastIndexOf("await") > -1) {
        this.set_applet_icon_path(this.icon_active);
        this.set_applet_tooltip(_("Await"));
        this.previousState = "await";
      }

      if (out.lastIndexOf("exited") > -1) {
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
