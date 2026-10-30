import {Config} from '@remotion/cli/config';

// O Chrome que o Remotion baixa pode não abrir nesta máquina; o Edge instalado funciona.
Config.setBrowserExecutable('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
Config.setChromeMode('chrome-for-testing');
Config.setVideoImageFormat('jpeg');
