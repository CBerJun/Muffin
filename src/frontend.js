const preset_code = `Muffin recipe
ingredients
    "Hello, world!" brand Flour
method
    1. set up a Muffin Cup
    2. add Flour into Muffin Cup
    3. microwave Muffin Cup
    4. serves 1
`;

document.addEventListener("DOMContentLoaded", (event) => {
    const code = document.getElementById('code');
    const initialState = cm6.createEditorState(preset_code);
    new cm6.EditorView({
        parent: code,
        state: initialState,
    });
});
