import { createFromRoot } from 'codama';
import { renderJavaScriptVisitor, renderRustVisitor } from '@codama/renderers';
import { rootNodeFromAnchor, type AnchorIdl} from '@codama/nodes-from-anchor';
import anchorIdl from '../idl/p_vote.json' with { type: 'json' };


const codama = createFromRoot(rootNodeFromAnchor(anchorIdl as AnchorIdl));
codama.accept(renderJavaScriptVisitor('clients/ts/src/', { formatCode: true, deleteFolderBeforeRendering: true,
    prettierOptions: {
      parser: 'typescript',
      singleQuote: true,
      trailingComma: 'all',
      printWidth: 80,
    }, }));
codama.accept(renderRustVisitor('clients/rust/src/', { crateFolder: "./", formatCode: true, deleteFolderBeforeRendering: true }));
