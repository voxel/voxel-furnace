
ModalDialog = require 'voxel-modal-dialog'
Inventory = require 'inventory'
InventoryWindow = require 'inventory-window'
ItemPile = require 'itempile'

module.exports = (game, opts) ->
  return new Furnace(game, opts)

module.exports.pluginInfo =
  loadAfter: ['voxel-registry', 'voxel-recipes', 'voxel-carry']

class Furnace
  constructor: (@game, opts) ->
    opts ?= {}

    @playerInventory = game.plugins?.get('voxel-carry')?.inventory ? opts.playerInventory ? throw new Error('voxel-furnace requires "voxel-carry" plugin or "playerInventory" set to inventory instance')
    @registry = game.plugins?.get('voxel-registry') ? throw new Error('voxel-furnace requires "voxel-registry" plugin')
    @recipes = game.plugins?.get('voxel-recipes') ? throw new Error('voxel-furnace requires "voxel-recipes" plugin')

    opts.registerBlock ?= true
    opts.registerRecipe ?= true
   
    if @game.isClient
      @furnaceDialog = new FurnaceDialog(game, @playerInventory, @registry, @recipes)

    @opts = opts
    @enable()

  enable: () ->
    if @opts.registerBlock
      @registry.registerBlock 'furnace', {texture: ['furnace_top', 'cobblestone', 'furnace_front_on'], onInteract: () =>
        # TODO: server-side
        @furnaceDialog.open()
        true
      }

    if @opts.registerRecipe
      @recipes.registerAmorphous(['cobblestone', 'cobblestone', 'cobblestone', 'cobblestone'], new ItemPile('furnace', 1))

  disable: () ->
    # TODO


# TODO: major refactor with voxel-workbench!
class FurnaceDialog extends ModalDialog
  constructor: (@game, @playerInventory, @registry, @recipes) ->
    # TODO: refactor with voxel-inventory-dialog
    @playerIW = new InventoryWindow {width: 10, registry:@registry, inventory:@playerInventory}

    # TODO: clear these inventories on close, or store in per-block metadata
    @craftInventory = new Inventory(3, 3)
    @craftInventory.on 'changed', () => @updateCraftingRecipe()
    @craftIW = new InventoryWindow {width:3, registry:@registry, inventory:@craftInventory, linkedInventory:@playerInventory}

    @resultInventory = new Inventory(1)
    @resultIW = new InventoryWindow {inventory:@resultInventory, registry:@registry, allowDrop:false, linkedInventory:@playerInventory}
    @resultIW.on 'pickup', () => @tookCraftingOutput()

    # crafting + result div, upper
    crDiv = document.createElement('div')
    crDiv.style.marginLeft = '30%'
    #crDiv.style.marginLeft = 'auto' # TODO: fix centering
    #crDiv.style.marginRight = 'auto'
    crDiv.style.marginBottom = '10px'
   
    craftCont = @craftIW.createContainer()

    resultCont = @resultIW.createContainer()
    resultCont.style.marginLeft = '30px'
    resultCont.style.marginTop = '15%'

    crDiv.appendChild(craftCont)
    crDiv.appendChild(resultCont)

    contents = []
    contents.push crDiv
    contents.push document.createElement('br') # TODO: better positioning
    # player inventory at bottom
    contents.push @playerIW.createContainer()

    super game, {contents: contents}

  # TODO: refactor again from voxel-inventory-dialog's crafting

  # changed crafting grid, so update recipe output
  updateCraftingRecipe: () ->
    recipe = @recipes.find(@craftInventory)
    console.log 'found recipe',recipe
    @resultInventory.set 0, recipe?.computeOutput(@craftInventory)

  # picked up crafting recipe output, so consume crafting grid ingredients
  tookCraftingOutput: () ->
    recipe = @recipes.find(@craftInventory)
    return if not recipe?

    recipe.craft(@craftInventory)
    @craftInventory.changed()

  close: () ->
    # exiting furnace returns in-progress crafting ingredients to player
    # TODO: inventory transfer() method
    for i in [0...@craftInventory.size()]
      if @craftInventory.get(i)
        excess = @playerInventory.give @craftInventory.get(i)
        #if excess # too bad, player loses if can't fit

      @craftInventory.set i, undefined

    super()


