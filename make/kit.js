const numbers = [
    { n: 1, selected: false },
    { n: 6, selected: false },
    { n: 8, selected: false },
    { n: 7, selected: false },
    { n: 2, selected: false },
    { n: 3, selected: false },
    { n: 5, selected: false },
    { n: 4, selected: false },
  ];
  
  const root = document.querySelector("#root");
  const wizard = document.querySelector("#wizard");
  
  function init() {
    root.innerHTML = "";
    
    let all = true;
    for (const i in numbers) {
      const n = numbers[i]
      if (n.n - 1 !== Number(i)) {
        all = false
      }
    }
    if (all) {
      wizard.classList.add("success")
    }
    
    for (const i in numbers) {
      const n = numbers[i]
      const step = document.createElement("div");
      step.id = n.n;
      step.innerText = n.n;
      step.classList.add("step")
      
      if (n.n - 1 === Number(i)) {
        step.classList.add("correct")
      }
      
      root.appendChild(step);
      step.addEventListener('click', function(e) {
        this.classList.toggle("selected");
        if (n.selected) {
          n.selected = false
          return
        }
        
        n.selected = true
  
        for (const j in numbers) {
          if (j === i) {
            continue
          }
  
          const n2 = numbers[j]
          if (n2.selected) {
            n.selected = false
            n2.selected = false
            numbers[j] = n
            numbers[i] = n2
            
            init()
            break
          }
        }
      })
    }
  }
  
  init()
  