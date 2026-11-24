/**
 * HTML Sanitizer for School CMS Articles
 * Removes dangerous tags, event handlers, javascript: protocols,
 * enforces rel="noopener noreferrer" on target="_blank" links,
 * ensures img responsive attributes, and downgrades h1 to h2
 * to maintain strict single-H1 document hierarchy.
 */

const DANGEROUS_TAG_REGEX = /<(?:script|style|iframe|object|embed|applet|form|input|button|textarea|select|svg|math|link|meta|base)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|applet|form|input|button|textarea|select|svg|math|link|meta|base)>|<(?:script|style|iframe|object|embed|applet|form|input|button|textarea|select|svg|math|link|meta|base)\b[^>]*\/?>/gi;

const COMMENT_REGEX = /<!--[\s\S]*?-->/g;

const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'span', 'div',
  'blockquote', 'pre', 'code',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'a', 'img', 'figure', 'figcaption',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  '*': new Set(['class', 'id', 'title', 'dir', 'lang']),
  'a': new Set(['href', 'target', 'rel', 'title', 'class']),
  'img': new Set(['src', 'alt', 'title', 'width', 'height', 'class', 'loading']),
  'th': new Set(['colspan', 'rowspan', 'scope', 'align', 'class']),
  'td': new Set(['colspan', 'rowspan', 'scope', 'align', 'class']),
  'ol': new Set(['start', 'type', 'class']),
  'blockquote': new Set(['cite', 'class']),
  'code': new Set(['class']),
  'pre': new Set(['class']),
};

export function sanitizeArticleHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // 1. Remove dangerous blocks and comments
  let clean = input
    .replace(COMMENT_REGEX, '')
    .replace(DANGEROUS_TAG_REGEX, '');

  clean = clean.replace(DANGEROUS_TAG_REGEX, '');

  // 2. Tokenize and sanitize all HTML tags
  const tagRegex = /<\/?([a-zA-Z0-9]+)(\s+[^>]*)?\/?>/g;

  clean = clean.replace(tagRegex, (fullMatch, rawTagName, rawAttrs) => {
    let tagName = rawTagName.toLowerCase();

    // Downgrade content h1 to h2 to preserve single-H1 on article page
    if (tagName === 'h1') {
      tagName = 'h2';
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      return '';
    }

    // Closing tag
    if (fullMatch.startsWith('</')) {
      return `</${tagName}>`;
    }

    const isSelfClosing = fullMatch.endsWith('/>') || ['img', 'br', 'hr'].includes(tagName);

    if (!rawAttrs) {
      if (tagName === 'img') {
        return '<img alt="" loading="lazy" class="max-w-full h-auto rounded-[8px]" />';
      }
      return isSelfClosing ? `<${tagName} />` : `<${tagName}>`;
    }

    // Parse attributes
    const attrRegex = /([a-zA-Z0-9_\-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let attrMatch;
    const cleanAttrs: Record<string, string> = {};
    const allowedForTag = ALLOWED_ATTRS[tagName] || new Set<string>();
    const globalAllowed = ALLOWED_ATTRS['*'];

    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      let attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

      // Strip any event handler (onerror, onload, onclick, etc.)
      if (attrName.startsWith('on')) {
        continue;
      }

      // Check if attribute is allowed
      if (!globalAllowed.has(attrName) && !allowedForTag.has(attrName)) {
        continue;
      }

      // Decode entities for protocol check
      const decodedVal = attrVal.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
                                .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                                .replace(/\s+/g, '');

      if (/^(?:javascript|vbscript|data):/i.test(decodedVal)) {
        if (tagName === 'img' && attrName === 'src' && /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(attrVal)) {
          // allowed safe data image
        } else {
          continue; // Block dangerous protocol
        }
      }

      // Safe href check for <a>
      if (tagName === 'a' && attrName === 'href') {
        const trimmed = attrVal.trim();
        // Disallow dangerous schemes or malformed protocols
        if (/^(?:javascript|vbscript|data):/i.test(trimmed)) {
          continue;
        }
        if (!/^(?:https?:\/\/|\/|mailto:|tel:|#|[a-zA-Z0-9_\-\.\/]+$)/i.test(trimmed)) {
          continue;
        }
      }

      // Safe src check for <img>
      if (tagName === 'img' && attrName === 'src') {
        const trimmed = attrVal.trim();
        if (/^(?:javascript|vbscript|data):/i.test(trimmed) && !/^data:image\//i.test(trimmed)) {
          continue;
        }
        if (!/^(?:https?:\/\/|\/|data:image\/|[a-zA-Z0-9_\-\.\/]+$)/i.test(trimmed)) {
          continue;
        }
      }

      cleanAttrs[attrName] = attrVal;
    }

    // Enforce security on <a> tags
    if (tagName === 'a') {
      if (cleanAttrs['target'] === '_blank') {
        cleanAttrs['rel'] = 'noopener noreferrer';
      } else if (cleanAttrs['target'] && cleanAttrs['target'] !== '_self') {
        cleanAttrs['target'] = '_self';
      }
    }

    // Enforce responsiveness & alt on <img> tags
    if (tagName === 'img') {
      if (!('alt' in cleanAttrs)) {
        cleanAttrs['alt'] = '';
      }
      cleanAttrs['loading'] = 'lazy';
      const existingClass = cleanAttrs['class'] || '';
      if (!existingClass.includes('max-w-full')) {
        cleanAttrs['class'] = `${existingClass} max-w-full h-auto rounded-[8px]`.trim();
      }
    }

    const serializedAttrs = Object.entries(cleanAttrs)
      .map(([k, v]) => `${k}="${v.replace(/"/g, '&quot;')}"`)
      .join(' ');

    const space = serializedAttrs ? ' ' : '';
    return isSelfClosing ? `<${tagName}${space}${serializedAttrs} />` : `<${tagName}${space}${serializedAttrs}>`;
  });

  return clean;
}
