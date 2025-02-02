import type { DeclarationPlain } from 'css-tree';
import ts from 'typescript';

import type { Dict } from '../../sb-serialize-preview/sb-serialize.model.js';
import type { NodeContext } from '../code.model.js';
import type { FlexNode, FrameNode2, SceneNode2 } from '../create-ts-compiler/canvas-utils.js';
import { isComponentSet, isFlexNode, isText } from '../create-ts-compiler/canvas-utils.js';
import type { FwAttr } from '../frameworks/framework-connectors.js';
import { addHugContents, makeDefaultNode } from '../gen-node-utils/default-node.js';

const { factory } = ts;

export function guessTagNameAndUpdateNode(context: NodeContext, node: SceneNode2, styles: Dict<DeclarationPlain>) {
  const shouldCheckParentName = context.isRootInComponent && isComponentSet(node.parent);
  const name = shouldCheckParentName ? node.parent!.name.toLowerCase() : context.nodeNameLower;
  const extraAttributes: FwAttr[] = [];
  const isWrapper = name.includes('wrapper');
  const isGroup = name.includes('group');
  const isFlex = isFlexNode(node);
  const nodeFlex = node as FlexNode;
  const hasFills = isFlex && Array.isArray(nodeFlex.fills) && nodeFlex.fills?.length >= 1;
  const hasStrokes = isFlex && nodeFlex.strokes?.length >= 1;
  const hasEffects = isFlex && nodeFlex.effects?.length >= 1;
  // If I want to use an img, the below code is the way to go. But the generic and simple way to handle multiple fills will be to use backgrounds, which is closer to how figma does it anyway.
  // const { images } = context.moduleContext.projectContext;
  /* if (images[node.id]) {
    context.tagName = 'img';
    extraAttributes.push(mkSrcStaticAttribute(images[node.id]));
    addStyle(styles, 'object-fit', 'cover');
  } else */ if (
    !context.moduleContext.inInteractiveElement &&
    isFlexNode(node) &&
    (hasFills || hasStrokes || hasEffects) &&
    (name === 'button' || (name.includes('button') && !isWrapper && !isGroup))
  ) {
    context.moduleContext = { ...context.moduleContext, inInteractiveElement: true };
    context.tagName = 'button';
  } else if (
    !context.moduleContext.inInteractiveElement &&
    isFlexNode(node) &&
    !node.children?.length &&
    (hasFills || hasStrokes || hasEffects) &&
    (name === 'checkbox' || (name.includes('checkbox') && !isWrapper && !isGroup))
  ) {
    // TODO Smart guess on input parent, if contains "label", turn it into a <label>. Tip:
    // function isInput() {}
    // function isCheckbox() {}

    if (context.parentNode?.children && context.parentContext?.tagName !== 'label') {
      const siblings = context.parentNode.children as readonly SceneNode2[];
      const i = siblings.indexOf(node);
      if (i !== -1) {
        const nextSibling = siblings[i + 1];
        // Condition to wrap the checkbox into a <label>: if one of them is true:
        // - Exactly 2 siblings, the first being the checkbox and the second text
        // - More than 2 siblings, and the sibling right after the checkbox is a text with name including "label"
        const shouldWrapInLabel =
          isText(nextSibling) && (siblings?.length === 2 || nextSibling.name.toLowerCase().includes('label'));
        if (shouldWrapInLabel) {
          const overrides: Partial<FrameNode2> = {
            children: [node, nextSibling],
            itemSpacing: node.itemSpacing,
          };
          node = makeDefaultNode('input label', overrides, addHugContents());
          context.tagName = 'label';
          (siblings as SceneNode[]).splice(i, 2, node as SceneNode);
          return [node, extraAttributes] as const;
        }
      }
    }
    context.moduleContext = { ...context.moduleContext, inInteractiveElement: true };
    context.tagName = 'input';
    extraAttributes.push(context.moduleContext.projectContext.fwConnector.createInputTypeAttr('checkbox'));
    // Padding has no effect on native checkboxes (Windows). Let's disable it and replace with width until we support styled checkboxes.
    node.paddingTop = 0;
    node.paddingRight = 0;
    node.paddingBottom = 0;
    node.paddingLeft = 0;
    // Below code was used for a demo. It doesn't seem very stable, so let's disable it in production for now.
    // } else if (
    //   !context.moduleContext.inInteractiveElement &&
    //   isFlexNode(node) &&
    //   (hasFills || hasStrokes || hasEffects) &&
    //   (name === 'input' || (name.includes('input') && !isWrapper && !isGroup)) &&
    //   (!node.children.length || (node.children.length === 1 && node.children[0].type === 'TEXT'))
    // ) {
    //   context.moduleContext = { ...context.moduleContext, inInteractiveElement: true };
    //   context.tagName = 'input';
    //   const hasTextChild = node.children.length === 1;
    //   if (hasTextChild) {
    //     const child = node.children[0] as TextNode2;
    //     const placeholder = child?._textSegments?.map(segment => segment.characters).join('');
    //     if (placeholder) {
    //       extraAttributes.push(mkStringAttr('placeholder', placeholder));
    //       context.firstChildIsPlaceholder = true;
    //     }
    //   }
  } else {
    // Keep the default tag name
  }
  return [node, extraAttributes] as const;
}
