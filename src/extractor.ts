// src/extractor.ts
// This file runs in the plugin UI iframe (has DOM/browser APIs).
// It is inlined into ui.html's <script> block via manual copying.
// All functions are attached to window.HtmlExtractor.

interface ExtractedStyle {
  display: string;
  position: string;
  top: number;
  left: number;
  right: number;
  bottom: number;
  flexDirection: string;
  justifyContent: string;
  alignItems: string;
  flexWrap: string;
  gap: number;
  width: number;
  height: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  color: string;
  backgroundColor: string;
  backgroundImage: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: string;
  lineHeight: number;
  letterSpacing: number;
  textAlign: string;
  textDecoration: string;
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
  borderRadius: number;
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
  boxShadow: string;
  opacity: number;
  overflow: string;
  boxSizing: string;
  tagName: string;
}

interface ExtractedNode {
  tag: string;
  children: ExtractedNode[];
  text: string;
  style: ExtractedStyle;
}

(function () {
  const ANIMATION_OVERRIDE = `
    *, *::before, *::after {
      animation: none !important;
      animation-duration: 0s !important;
      transition: none !important;
      transition-duration: 0s !important;
      transform: none !important;
    }
  `;

  function stripAnimations(doc: Document): void {
    const style = doc.createElement('style');
    style.textContent = ANIMATION_OVERRIDE;
    doc.head.appendChild(style);

    // Remove scripts
    doc.querySelectorAll('script').forEach(el => el.remove());
    // Remove non-static elements
    doc.querySelectorAll('canvas, video, audio, iframe').forEach(el => el.remove());
    // Remove hidden elements
    doc.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove());
    // Open all <details> elements so content is visible
    doc.querySelectorAll('details').forEach(el => el.setAttribute('open', ''));
  }

  function extractStyle(el: Element): ExtractedStyle {
    const cs = window.getComputedStyle(el);

    const px = (prop: string): number => {
      const v = cs.getPropertyValue(prop);
      const m = v.match(/^([\d.]+)px$/);
      return m ? parseFloat(m[1]) : 0;
    };

    const paddingTop = px('padding-top');
    const paddingRight = px('padding-right');
    const paddingBottom = px('padding-bottom');
    const paddingLeft = px('padding-left');
    const marginTop = px('margin-top');
    const marginRight = px('margin-right');
    const marginBottom = px('margin-bottom');
    const marginLeft = px('margin-left');
    const borderTopWidth = px('border-top-width');
    const borderRightWidth = px('border-right-width');
    const borderBottomWidth = px('border-bottom-width');
    const borderLeftWidth = px('border-left-width');

    const width = cs.getPropertyValue('width');
    const height = cs.getPropertyValue('height');
    const widthPx = width.endsWith('px') ? parseFloat(width) : el.getBoundingClientRect().width;
    const heightPx = height.endsWith('px') ? parseFloat(height) : el.getBoundingClientRect().height;

    const gapPx = px('column-gap') || px('gap') || px('row-gap');

    return {
      display: cs.getPropertyValue('display'),
      position: cs.getPropertyValue('position'),
      top: px('top'),
      left: px('left'),
      right: px('right'),
      bottom: px('bottom'),
      flexDirection: cs.getPropertyValue('flex-direction'),
      justifyContent: cs.getPropertyValue('justify-content'),
      alignItems: cs.getPropertyValue('align-items'),
      flexWrap: cs.getPropertyValue('flex-wrap'),
      gap: gapPx,
      width: Math.round(widthPx),
      height: Math.round(heightPx),
      paddingTop, paddingRight, paddingBottom, paddingLeft,
      marginTop, marginRight, marginBottom, marginLeft,
      color: cs.getPropertyValue('color'),
      backgroundColor: cs.getPropertyValue('background-color'),
      backgroundImage: cs.getPropertyValue('background-image'),
      fontSize: px('font-size'),
      fontFamily: cs.getPropertyValue('font-family').split(',')[0].replace(/['"]/g, '').trim(),
      fontWeight: parseFloat(cs.getPropertyValue('font-weight')) || 400,
      fontStyle: cs.getPropertyValue('font-style'),
      lineHeight: parseFloat(cs.getPropertyValue('line-height')) || px('font-size') * 1.2,
      letterSpacing: px('letter-spacing'),
      textAlign: cs.getPropertyValue('text-align'),
      textDecoration: cs.getPropertyValue('text-decoration'),
      borderTopWidth, borderRightWidth, borderBottomWidth, borderLeftWidth,
      borderTopColor: cs.getPropertyValue('border-top-color'),
      borderRightColor: cs.getPropertyValue('border-right-color'),
      borderBottomColor: cs.getPropertyValue('border-bottom-color'),
      borderLeftColor: cs.getPropertyValue('border-left-color'),
      borderRadius: px('border-radius'),
      borderTopLeftRadius: px('border-top-left-radius'),
      borderTopRightRadius: px('border-top-right-radius'),
      borderBottomRightRadius: px('border-bottom-right-radius'),
      borderBottomLeftRadius: px('border-bottom-left-radius'),
      boxShadow: cs.getPropertyValue('box-shadow'),
      opacity: parseFloat(cs.getPropertyValue('opacity')) || 1,
      overflow: cs.getPropertyValue('overflow'),
      boxSizing: cs.getPropertyValue('box-sizing'),
      tagName: el.tagName.toLowerCase(),
    };
  }

  function extractNode(el: Element): ExtractedNode {
    const tag = el.tagName.toLowerCase();
    const children: ExtractedNode[] = [];
    let text = '';

    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const content = child.textContent?.trim();
        if (content) text += content;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child as Element;
        const display = window.getComputedStyle(childEl).getPropertyValue('display');
        if (display === 'none') continue;
        children.push(extractNode(childEl));
      }
    }

    return { tag, children, text, style: extractStyle(el) };
  }

  function extractFromHtml(html: string): Promise<ExtractedNode> {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;left:-9999px;width:1440px;height:900px;border:none;';
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow!.document;
          stripAnimations(doc);

          requestAnimationFrame(() => {
            try {
              const body = doc.body || doc.documentElement;
              const root = extractNode(body);
              document.body.removeChild(iframe);
              resolve(root);
            } catch (e) {
              document.body.removeChild(iframe);
              reject(e);
            }
          });
        } catch (e) {
          document.body.removeChild(iframe);
          reject(e);
        }
      };

      iframe.onerror = () => {
        document.body.removeChild(iframe);
        reject(new Error('Failed to load HTML in iframe'));
      };

      iframe.srcdoc = html;
    });
  }

  (window as any).HtmlExtractor = { extractFromHtml, extractNode, extractStyle, stripAnimations };
})();
