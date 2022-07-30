# psi-client-linux
Psiphon Tunnel Core README For Linux amd64 debian debs as demon
================================================================================

Overview
--------------------------------------------------------------------------------

Psiphon is an Internet censorship circumvention system.

The tunnel core project includes a tunneling client and server, which together implement key aspects of evading blocking and relaying client traffic through Psiphon and beyond censorship.

All Psiphon open source projects, including the complete open source code for Android, iOS, and Windows clients may be found at [www.github.com/Psiphon-Inc/psiphon](https://www.github.com/Psiphon-Inc/psiphon).

For more information about Psiphon Inc., please visit our web site at [www.psiphon.ca](https://www.psiphon.ca).

psi-client cli for manage service
psi-client@Human  applet for cinnamon

Restart Cinnamon on Ctrol+Alt+F3
DISPLAY=:0 cinnamon --replace

Install on Linux
cd psi-client****
sudo dpkg-buildpackage -us -uc -tc
sudo dpkg -i ../psi-client*.deb 
