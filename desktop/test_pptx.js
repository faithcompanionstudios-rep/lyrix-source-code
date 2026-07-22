const Pptx2Json = require('pptx2json');

async function test() {
    const pptx2json = new Pptx2Json();
    // Assuming there's a pptx to test. Let's create one or just look at the module.
    console.log(Object.keys(pptx2json));
}
test();
