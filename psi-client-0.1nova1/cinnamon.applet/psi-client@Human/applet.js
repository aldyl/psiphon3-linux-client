const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const MainLoop = imports.mainloop;
const Gettext = imports.gettext;
const St = imports.gi.St;
const UUID = "psi-client@Human";

const PopupMenu = imports.ui.popupMenu; // Create the PopUp Menu

const _ = function (str) {
  let translation = Gettext.gettext(str);
  if (translation !== str) {
    return translation;
  }
  return Gettext.dgettext(UUID, str);
};

function PsiClientApplet(metadata, orientation, instance_id) {
  this._init(metadata, orientation, instance_id);
}

PsiClientApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function (metadata, orientation, instance_id) {
    Applet.IconApplet.prototype._init.call(this, orientation, instance_id);

    //State icons
    this.icon_connected = (metadata.path + "/Data/connected.svg")
      .toString()
      .trim();
    this.icon_active = (metadata.path + "/Data/await.svg").toString().trim();
    this.icon_active_exited = (metadata.path + "/Data/await.svg")
      .toString()
      .trim();
    this.icon_inactive = (metadata.path + "/Data/inactive.svg")
      .toString()
      .trim();

    //Service status
    let serviceState = "falsefalsefalse";

    try {
      //Variables
      this.restartService = false;
      this.stopService = false;

      this.isLooping = true;
      this.waitForCmd = false;
      this.servicePath = null;
      this.is_connected = false;
      this.psiClientPath = "/etc/init.d/psi-client";

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
        "interval"
      );

      this.menuItemsInfo = [];

      // Create the popup menu
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);

      //Detect valid path
      if (!this.servicePath) this.detectService();

      //Check service status
      this.check_service_status();
      this.loopId = MainLoop.timeout_add(this.state.interval, () =>
        this.check_service_status()
      );

      this.set_applet_icon_path(this.icon_inactive);
    } catch (e) {
      global.logError(e);
    }
  },

  on_settings_changed: function () {
    if (this.loopId > 0) {
      MainLoop.source_remove(this.loopId);
    }
    this.loopId = 0;
    this.restartService = true;
    this.check_service_status();
    this.loopId = MainLoop.timeout_add(this.state.interval, () =>
      this.check_service_status()
    );
  },

  detectService: function () {
    let resp = " " + GLib.spawn_command_line_sync("service psi-client");
    let is_active = resp.indexOf(this.psiClientPath) > -1;

    // detect if service is available

    if (is_active) {
      this.servicePath = this.psiClientPath;
    } else {
      this.servicePath = null;
    }

    if (this.servicePath) {
      this.set_applet_tooltip(" " + _("Service found ") + this.servicePath);
    } else {
      this.set_applet_tooltip(
        " " + _("Please install psi-client service") + this.servicePath
      );
    }
  },

  on_applet_clicked: function () {
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

    connect_button.connect("activate", Lang.bind(this, this._connect_button));

    let disconnect_button = new PopupMenu.PopupIconMenuItem(
      _("Disconnect"),
      "security-low-symbolic",
      St.IconType.SYMBOLIC
    );
    disconnect_button.connect(
      "activate",
      Lang.bind(this, this._disconnect_button)
    );

    let section_buttons = new PopupMenu.PopupMenuSection();

    if (this.is_connected) section_buttons.addMenuItem(disconnect_button);
    else section_buttons.addMenuItem(connect_button);

    this.menu.addMenuItem(section_buttons);

    if (isOpen) {
      this.menu.open();
    }
  },

  check_service_status_exec: function (action) {
    let textOut =
      " " + GLib.spawn_command_line_sync(this.servicePath + " " + action);
    return textOut;
  },

  _connect_button: function (option, event) {
    GLib.spawn_command_line_sync("psi-client --action=restart");
  },

  _disconnect_button: function (option, event) {
    GLib.spawn_command_line_sync("psi-client --action=stop");
  },

  check_service_status: function () {
    if (!this.isLooping) {
      return false;
    }

    try {
      if (this.servicePath && !this.waitForCmd) {
        this.waitForCmd = true;

        this.check_service_status_icon(
          this.check_service_status_exec("status")
        );
      }
    } catch (e) {
      global.logError(e);
      return false;
    }

    return true;
  },

  check_service_status_icon: function (statusStr) {
    let items_info = []; //Items for menu

    let is_active = statusStr.indexOf("active (running)") > -1; // Allow  for stopping
    let is_active_exited = statusStr.indexOf("active (exited)") > -1; // Allow for restart
    let is_inactive = statusStr.indexOf("inactive (dead)") > -1; // Allow for starting

    let currentState = "" + is_active + is_active_exited + is_inactive;

    if (is_active) {
      let connected =
        " " + GLib.spawn_command_line_sync(this.servicePath + " logcat");

      this.is_connected =
        connected.lastIndexOf('"data":{"count":1},"noticeType":"Tunnels"') >
        connected.lastIndexOf('"data":{"count":0},"noticeType":"Tunnels"');

      global.log("assas " + this.is_connected);
      if (this.is_connected) {
        this.set_applet_icon_path(this.icon_connected);
        this.set_applet_tooltip(_("Connected: ") + this.state.location);

        items_info.push(_("Service Connected"));
        items_info.push(_("Country: ") + this.state.location);
        items_info.push(_("IP: ") + "156.12.34.23");
      } else {
        this.set_applet_icon_path(this.icon_active);
        this.set_applet_tooltip(_("Await for network"));
        items_info.push(_("Await for Network"));
      }
    } else {
      this.set_applet_tooltip(_("Service off "));
      items_info.push(_("Service Disconnected"));

      if (is_active_exited) {
        this.set_applet_icon_path(this.icon_active_exited);
      }
      if (is_inactive) {
        this.set_applet_icon_path(this.icon_inactive);
      }
    }

    if (this.menu.isOpen) {
      this.buildMenu(items_info);
    } else {
      this.menuItemsInfo = items_info;
    }

    this.waitForCmd = false;
    return true;
  },
};

function main(metadata, orientation, instance_id) {
  return new PsiClientApplet(metadata, orientation, instance_id);
}
