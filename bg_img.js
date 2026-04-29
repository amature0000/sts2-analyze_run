const backgroundImages = {
  'ironclad': 'url("images/ironclad_background.jpg")',
  'regent': 'url("images/regent_background.jpg")',
  'silent': 'url("images/silent_background.jpg")',
  'necrobinder': 'url("images/necrobinder_background.jpg")',
  'defect': 'url("images/defect_background.jpg")'
};

function changeBackground(character) {
  const bgImage = backgroundImages[character];
  document.body.style.backgroundImage = bgImage;
}