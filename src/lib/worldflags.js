// Accurate flag artwork (flag-icons, MIT) for the competitors' countries.
import au from 'flag-icons/flags/4x3/au.svg?url';
import nz from 'flag-icons/flags/4x3/nz.svg?url';
import us from 'flag-icons/flags/4x3/us.svg?url';
import cn from 'flag-icons/flags/4x3/cn.svg?url';
import jp from 'flag-icons/flags/4x3/jp.svg?url';
import vn from 'flag-icons/flags/4x3/vn.svg?url';
import tw from 'flag-icons/flags/4x3/tw.svg?url';
import my from 'flag-icons/flags/4x3/my.svg?url';
import th from 'flag-icons/flags/4x3/th.svg?url';
import ph from 'flag-icons/flags/4x3/ph.svg?url';
import fr from 'flag-icons/flags/4x3/fr.svg?url';
import hu from 'flag-icons/flags/4x3/hu.svg?url';
import fj from 'flag-icons/flags/4x3/fj.svg?url';
import sg from 'flag-icons/flags/4x3/sg.svg?url';

const URLS = { au, nz, us, cn, jp, vn, tw, my, th, ph, fr, hu, fj, sg };
export const flagUrl = (code) => URLS[code] || '';
