import os

systems = {
    'physics': 10,
    'collision': 20,
    'teleportation': 30,
    'gravity': 40,
    'food_eating': 50,
    'boost': 60,
    'growth': 70,
    'serialization': 80
}

dir_path = 'app/engine/systems'
for name, order in systems.items():
    file_path = os.path.join(dir_path, f'{name}.py')
    with open(file_path, 'a', encoding='utf-8') as f:
        func = 'update'
        if name == 'collision':
            func = 'check'
        elif name == 'serialization':
            func = 'prepare_cache'
            
        code = f'''\n
class {name.capitalize()}System:
    name = "{name}"
    order = {order}
    
    def update(self, world):
        {func}(world)

system = {name.capitalize()}System()
'''
        f.write(code)
