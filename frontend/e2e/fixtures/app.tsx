import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { fixture } from './catalog';
import '../../src/global.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/source-sans-3/latin-400.css';
createRoot(document.getElementById('root')!).render(<><div style={{background:'#fff1b8',padding:12,textAlign:'center',fontWeight:700}}>TEST FIXTURE — invented sections for behavior verification, not Dartmouth offerings</div><App catalog={fixture}/></>);
