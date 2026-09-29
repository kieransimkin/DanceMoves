import path from 'node:path';
import {createDownloadService} from '@kieransimkin/dancemoves/server';
import Demo from './Demo.jsx';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export default function Page(){
 const secret=process.env.DANCEMOVES_DOWNLOAD_SECRET;
 const origin=process.env.DANCEMOVES_ORIGIN || 'http://localhost:3000';
 const service=secret?createDownloadService({rootDirectory:path.resolve(process.cwd(),'public/media'),secret,origin}):null;
 return <Demo downloadUrl={service?.sign('arcadians.mp3') || ''} captureEnabled={!!process.env.DANCEMOVES_CAPTURE_KEY && !!process.env.DANCEMOVES_CAPTURE_DIR}/>;
}
