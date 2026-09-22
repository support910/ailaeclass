import DriveResults from '../../../src/lib/components/Simulator/DriveResults.svelte';
import { locale } from '$lib/utils/functions/translations';
import '../../../src/app.postcss';
window.setTestLocale = (value) => locale.set(value);
new DriveResults({ target: document.getElementById('app') });
