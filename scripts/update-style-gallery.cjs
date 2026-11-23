// Refresh the offline style gallery from the existing style and image indexes.
const fs = require('node:fs');
const path = require('node:path');

const skill = path.resolve(__dirname, '..');
const examples = path.join(skill, 'examples');
const routes = fs.readFileSync(path.join(skill, 'references', 'styles.md'), 'utf8');
const gallery = fs.readFileSync(path.join(examples, 'README.md'), 'utf8');
const routePattern = /^\| (\d+)\. ([^|]+?) \| .([a-z0-9-]+). \| ([^|]+?) \|/gm;
const sectionPattern = /^## (\d+)\. [^\r\n]+/gm;
const imagePattern = /^!\[([^\]\r\n]+)\]\(([^)\r\n]+\.webp)\)/gm;
const sections = [...gallery.matchAll(sectionPattern)];
const styles = [...routes.matchAll(routePattern)].map(([, number, name, slug, aliases]) => ({
  number: Number(number), name, slug, aliases,
}));
if (!styles.length || styles.length !== sections.length) {
  throw new Error('Style registry and example headings do not match.');
}
const seen = new Set();
for (let i = 0; i < styles.length; i++) {
  const style = styles[i];
  const heading = sections[i];
  if (style.number !== i + 1 || style.number !== Number(heading[1]) ||
      heading[0] !== '## ' + style.number + '. ' + style.name) {
    throw new Error('Style name or number mismatch: ' + style.name);
  }
  const text = gallery.slice(heading.index, sections[i + 1]?.index ?? gallery.length);
  style.examples = [...text.matchAll(imagePattern)].map(([, title, image]) => {
    if (!image.startsWith(style.slug + '/') || image.split('/').length !== 2 ||
        !fs.statSync(path.join(examples, image), {throwIfNoEntry:false})?.isFile() ||
        seen.has(image)) {
      throw new Error('Unexpected or missing preview: ' + image);
    }
    seen.add(image);
    return {title, path: image.split('/').map(encodeURIComponent).join('/')};
  });
  if (!style.examples.length && !text.includes('暂未归档实图示例。')) {
    throw new Error('No preview or pending note for: ' + style.name);
  }
}

const galleryPath = path.join(examples, 'gallery.html');
const current = fs.readFileSync(galleryPath, 'utf8');
const data = JSON.stringify(styles).replace(/</g, '\\u003c');
const pattern = /(<script id="catalog" type="application\/json">)[\s\S]*?(<\/script>)/g;
if ([...current.matchAll(pattern)].length !== 1) throw new Error('Missing or duplicate gallery data marker.');
const updated = current.replace(pattern, (_all, start, end) => start + '\n' + data + '\n' + end);
if (process.argv.includes('--check')) {
  if (current !== updated) throw new Error('Run the gallery updater to refresh the example list.');
} else if (current !== updated) {
  fs.writeFileSync(galleryPath, updated, 'utf8');
}
console.log(styles.length + ' styles; ' + seen.size + ' linked previews.');
